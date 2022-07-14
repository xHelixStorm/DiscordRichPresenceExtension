document.body.addEventListener("click", (event) => {
    var returnEvent = {
        url: event.target.baseURI,
        innerHtml: event.target.innerHTML,
        innerText: event.target.innerText,
        node: event.target.localName,
        attributes: []
    };
    if (event.target.attributes) {
        for (var i = 0; i < event.target.attributes.length; i++) {
            returnEvent.attributes[i] = {
                attribute: event.target.attributes[i].name,
                value: event.target.attributes[i].nodeValue
            };
        }
    }

    chrome.runtime.sendMessage({
        action: "getDomClick",
        source: returnEvent
    });
});

