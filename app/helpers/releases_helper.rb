# frozen_string_literal: true
module ReleasesHelper
  GITHUB_STATUS_ICONS = {
    "success" => "ok",
    "failure" => "remove",
    "missing" => "minus",
    "pending" => "hourglass"
  }.freeze

  GITHUB_STATUS_TEXT_LABELS = {
    "success" => "success",
    "failure" => "danger",
    "missing" => "muted",
    "pending" => "primary"
  }.freeze

  def release_label(project, release)
    link_to(
      release.version,
      [project, release],
      class: "release-label label label-success", data: {ref: release.version}
    )
  end

  def github_commit_status_icon(status_state)
    icon = GITHUB_STATUS_ICONS.fetch(status_state)
    text = GITHUB_STATUS_TEXT_LABELS.fetch(status_state)
    title = "Github status: #{status_state}"

    icon_tag icon, class: "text-#{text}", 'data-toggle': "tooltip", 'data-placement': "right", title: title
  end

  def link_to_deploy_stage(stage, release)
    deploy_params = {reference: release.version}

    if stage.confirm?
      link_to stage.name, new_project_stage_deploy_path(@project, stage, deploy_params)
    else
      link_to stage.name, project_stage_deploys_path(@project, stage, deploy: deploy_params), method: :post
    end
  end
end
