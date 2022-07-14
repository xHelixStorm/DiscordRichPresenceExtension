var prevPort = null;
var prevHost = null;

chrome.storage.local.get(null, (data) => {
    if (data.port) {
        prevPort = data.port;
    }
    else {
        prevPort = "0";
    }
    if (data.host) {
        prevHost = data.host;
    }
    else {
        prevHost = "127.0.0.1";
    }
    $("#inputPort").val(prevPort);
    $("#inputHost").val(prevHost);
});

document.getElementById("save").addEventListener("click", () => {
    $("#loading").css({ visibility: "visible" });
    $("#infoText").css({ visibility: "hidden" });

    $.ajax({
        url: $("#inputHost").val() + ":" + $("#inputPort").val() + "/test",
        method: "GET",
        success: () => {
            $("#infoText").text("Options have been saved!");
            $("#infoText").removeClass("red").addClass("green");
            $("#infoText").css({ visibility: "visible" });
            chrome.storage.local.set({ "port": $("#inputPort").val() });
            chrome.storage.local.set({ "host": $("#inputHost").val() });
            $("#loading").css({ visibility: "hidden" });
        }
    }).fail(() => {
        $("#infoText").text("Options couldn't be saved because the connection test didn't work! Is the client running?");
        $("#infoText").removeClass("green").addClass("red");
        $("#infoText").css({ visibility: "visible" });
        $("#loading").css({ visibility: "hidden" });
    });
});

document.getElementById("reset").addEventListener("click", () => {
    $("#inputPort").val(prevPort);
    $("#inputHost").val(prevHost);
    $("#infoText").css({ visibility: "hidden" });
});

document.getElementById("close").addEventListener("click", () => {
    this.close();
});