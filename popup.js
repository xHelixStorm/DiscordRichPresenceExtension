var port = null;
var host = null;

chrome.storage.local.get("port", (data) => {
    port = data.port;
});
chrome.storage.local.get("host", (data) => {
    host = data.host;
});
chrome.storage.local.get("lastSynch", (data) => {
    $("#synchDate").text(data.lastSynch);
});

chrome.storage.local.get(null, (data) => {
    if (data) {
        for (var key in data) {
            if (new RegExp(/^[\d]{1,}$/).test(key) && data[key].active) {
                var status = data[key];
                $("#tab").text(status.targetRequired ? status.tabTarget.id : status.tab.id);
                $("#profileName").text(status.profile.ProfileName);
                $("#name").text(status.profile.Name);
                $("#state").text(status.profile.State);
                $("#details").text(status.profile.Details);
                $("#largeImage").text(status.profile.LargeImage);
                $("#largeText").text(status.profile.LargeText);
                $("#smallImage").text(status.profile.SmallImage);
                $("#smallText").text(status.profile.SmallText);
                $("#key").text(status.profile.Key);

                $("#profile").show();
            }
        }
    }
});

document.getElementById("synch").addEventListener("click", () => {
    $("#synchIcon").addClass("fa-spin");

    $.ajax({
        url: host + ":" + port + "/profiles",
        method: "GET",
        success: function (response) {
            chrome.storage.local.set({ "profiles": response });
            var date = new Date(Date.now());
            $("#synchDate").text(
                date.getDate().toString().padStart(2, "0") + "." +
                ( date.getMonth() + 1 ).toString().padStart(2, "0") + "." +
                date.getFullYear().toString().padStart(2, "0") + " " +
                date.getHours().toString().padStart(2, "0") + ":" +
                date.getMinutes().toString().padStart(2, "0") + ":" +
                date.getSeconds().toString().padStart(2, "0")
            );
            chrome.storage.local.set({ "lastSynch": $("#synchDate").text() });
            $("#synchIcon").removeClass("fa-spin");
        }
    }).fail(function (jqXHR) {
        $("#synchIcon").removeClass("fa-spin");
    });
});

document.getElementById("stopProfile").addEventListener("click", () => {
    $.ajax({
        url: host + ":" + port + "/activity",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ action: "stop" }),
        success: (response) => {
            var tabId = $("#tab").text();
            chrome.storage.local.get(tabId, (status) => {
                if (!status) return;
                status.active = false;
                chrome.storage.local.set({ [tabId]: status }, () => {
                    $("#profile").hide();
                });
            });
        }
    });
});