require 'csv'

class CsvExportJob < ActiveJob::Base
  queue_as :csv_jobs

  def perform(csv_export)
    ActiveRecord::Base.connection_pool.with_connection do
      create_export_folder(csv_export)
      generate_csv(csv_export)
      cleanup_downloaded
    end
  end

  private

  def cleanup_downloaded
    CsvExport.old.find_each(&:destroy!)
  end

  def generate_csv(csv_export)
    csv_export.status! :started
    deploy_csv_export(csv_export)
    CsvMailer.created(csv_export).deliver_now if csv_export.email.present?
    csv_export.status! :finished
    Rails.logger.info("Export #{csv_export.download_name} completed")
  rescue Errno::EACCES, IOError, ActiveRecord::ActiveRecordError => e
    csv_export.delete_file
    csv_export.status! :failed
    Rails.logger.error("Export #{csv_export.id} failed with error #{e}")
    Airbrake.notify(e, error_message: "Export #{csv_export.id} failed.")
  end

  def deploy_csv_export(csv_export)
    filename = csv_export.path_file
    filter = csv_export.filters

    get_deploys(filter)
    summary = ["-", "Generated At", csv_export.updated_at, "Deploys", @deploys.count.to_s]
    filters_applied = ["-", "Filters", filter.to_json]

    CSV.open(filename, 'w+') do |csv|
      csv << Deploy.csv_header
      @deploys.find_each do |deploy|
        csv << deploy.csv_line
      end
      csv << summary
      csv << filters_applied
    end
  end

  def get_deploys(filter)
    if filter.keys.include?('environments.production')
      production_value = filter.delete('environments.production')
      # To match logic of stages.production? True when any deploy_group environment is true or
      # deploy_groups environment is empty and stages is true
      production_query = "(A.production = ? OR (A.production IS NULL AND stages.production = ?))"
      production_query = "NOT " + production_query if production_value == false

      # The query could result in duplicate entries when a stage has a production and non-production deploy group
      # so it is important this is run only if enviornments.production was set
      @deploys = Deploy.includes(:buddy, job: :user, stage_with_deleted: :project).
        joins("INNER JOIN jobs ON jobs.id = deploys.job_id INNER JOIN stages ON stages.id = deploys.stage_id").
        joins("LEFT JOIN " \
          "(SELECT DISTINCT deploy_groups_stages.stage_id, environments.production FROM deploy_groups_stages " \
          "INNER JOIN deploy_groups ON deploy_groups.id = deploy_groups_stages.deploy_group_id " \
          "INNER JOIN environments ON environments.id = deploy_groups.environment_id) A ON A.stage_id = stages.id").
        unscope(where: :deleted_at).where(filter).where(production_query, true, true)
    else
      @deploys = Deploy.includes(:buddy, job: :user, stage_with_deleted: :project).
        joins("INNER JOIN jobs ON jobs.id = deploys.job_id INNER JOIN stages ON stages.id = deploys.stage_id").
        unscope(where: :deleted_at).where(filter)
    end
  end

  def create_export_folder(csv_export)
    FileUtils.mkdir_p(File.dirname(csv_export.path_file))
  end
end
