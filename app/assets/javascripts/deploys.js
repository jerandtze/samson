//= require typeahead
var following = true;
$(function () {
  var changesetLoaded = false;

  $("#deploy-tabs a[data-type=github]").click(function (e) {
      e.preventDefault();
      var tab = $(this);
      tab.tab("show");

      if (!changesetLoaded) {
        var changesetUrl = $("#deploy-tabs").data("changesetUrl");

        changesetLoaded = true;

        $.ajax({
          url: changesetUrl,
          dataType: "html",
          success: function (data) {
            var container = $(".deploy-details");
            var placeholderPanes = container.find(".changeset-placeholder");

            placeholderPanes.remove();
            $('#output').after(data);

            // We need to switch to another tab and then switch back in order for
            // the plugin to detect that the DOM node has been replaced.
            $("#deploy-tabs a:first").tab("show");
            tab.tab("show");
          }
        });
      }
  });

  $(".deploy-details").on("click", ".file-summary", function (e) {
    var row = $(this);
    var patch = row.next();

    patch.toggle();
  });

  $("span[data-time]").each(function() {
    var utcms     = this.dataset.time,
        localDate = new Date(parseInt(utcms));

    this.title = localDate.toString();
  });

  var prefetchUrl = $("#deploy_reference").data("prefetchUrl");

  $("#deploy_reference").typeahead({
    name: "releases",
    prefetch: {
      url: prefetchUrl,
      ttl: 30000 // 30 seconds
    }
  });

  // The typeahead plugin removes the focus from the input - restore it
  // after initialization.
  $("#deploy_reference").focus();

  // Shows commit status from Github as border color
  var timeout = null;
  var tag_form_group = $("#deploy_reference").parent();

  function check_status(ref) {
    $.ajax({
      url: $("#new_deploy").data("commit-status-url"),
      data: { ref: ref },
      success: function(data, status, xhr) {
        if(data.status == "pending") {
          tag_form_group.addClass("has-warning");
        } else if(data.status == "success") {
          tag_form_group.addClass("has-success");
        } else if(data.status == "failure" || data.status == "error") {
          tag_form_group.addClass("has-error");
        }
      }
    });
  }

  $("#deploy_reference").keyup(function() {
    tag_form_group.removeClass("has-success has-warning has-error");

    var ref = $(this).val();

    if(timeout) {
      clearTimeout(timeout);
    }

    if(ref !== "") {
      timeout = setTimeout(function() { check_status(ref); }, 200);
    }
  });

  // Shows confirmation dropdown using Github comparison
  var confirmed = false,
      $container = $(".deploy-details"),
      $placeholderPanes = $container.find(".changeset-placeholder");

  $("#new_deploy").submit(function(event) {
    var $selected_stage = $("#deploy_stage_id option:selected"),
        $this = $(this);

    if(!confirmed && $selected_stage.data("confirmation")) {
      $("#confirm-button-text").show();
      $("#deploy-button-text").hide();
      $("#deploy-confirmation").show();
      $("#deploy-confirmation .nav-tabs a:first").tab("show");
      $container.empty();
      $container.append($placeholderPanes);

      confirmed = true;

      $.ajax({
        method: "POST",
        url: $this.data("confirm-url"),
        data: $this.serialize(),
        success: function(data, status, xhr) {
          $placeholderPanes.detach();
          $container.append(data);

          // We need to switch to another tab and then switch back in order for
          // the plugin to detect that the DOM node has been replaced.
          $('#deploy-confirmation .nav-tabs a').tab("show");
          $('#deploy-confirmation .nav-tabs a:first').tab("show");
        }
      });

      event.preventDefault();
    }
  });

  $("#new-deploy-cancel").click(function(event) {
    if(confirmed) {
      $("#deploy-confirmation").hide();

      $("#confirm-button-text").hide();
      $("#deploy-button-text").show();

      confirmed = false;
    } else {
      window.location = $(this).data("url");
    }

    event.preventDefault();
  });

  function shrinkOutput() {
    $("#messages").css("max-height", 550);
  }

  $("#output-follow").click(function(event) {
    following = true;

    shrinkOutput();
    $("#messages").scrollTop($messages.prop("scrollHeight"));

    $("#output-options > button").removeClass("active");
    $(this).addClass("active");
  });

  function growOutput() {
    $("#messages").css("max-height", "none");
  }

  $("#output-grow-toggle").click(function(event) {
    $self = $(this);

    if($self.hasClass("active")) {
      shrinkOutput();
      $self.removeClass("active");
    } else {
      growOutput();
      $self.addClass("active");
    }
  });

  $("#output-grow").click(function(event) {
    growOutput();

    $("#output-options > button").removeClass("active");
    $(this).addClass("active");
  });

  $("#output-steady").click(function(event) {
    following = false;

    shrinkOutput();

    $("#output-options > button").removeClass("active");
    $(this).addClass("active");
  });
});

function startDeployStream() {
  $(document).ready(function() {
    var messages = $("#messages");
    var streamUrl = $("#output").data("streamUrl");
    var source = new EventSource(streamUrl);

    var addLine = function(data) {
      var msg = JSON.parse(data).msg;
      messages.append(msg);
      if (following) {
        messages.scrollTop(messages[0].scrollHeight);
      }
    };

    source.addEventListener('append', function(e) {
      addLine(e.data);
    }, false);

    source.addEventListener('viewers', function(e) {
      var users = JSON.parse(e.data);

      if(users.length > 0) {
        var viewers = $.map(users, function(user) {
          return user.name;
        }).join(', ') + '.';

        $('#viewers-link .badge').html(users.length);
        $("#viewers").html('Other viewers: ' + viewers);
      } else {
        $('#viewers-link .badge').html(0);
        $("#viewers").html('No other viewers.');
      }
    }, false);

    source.addEventListener('replace', function(e) {
      messages.children().last().remove();
      addLine(e.data);
    }, false);

    source.addEventListener('finished', function(e) {
      $('#header').html(JSON.parse(e.data).html);
      $('.only-active').hide();
      source.close();
    }, false);
  });
}
