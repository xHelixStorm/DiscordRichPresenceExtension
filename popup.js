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