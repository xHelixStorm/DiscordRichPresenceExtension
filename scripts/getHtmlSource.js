var DomToArray = function (elements) {
    var el = [];
    for (var key in elements) {
        if (new RegExp(/^[\d]*$/).test(key)) {
            var element = elements[key];
            var numKey = parseInt(key);
            el[numKey] = {
                id: element.id,
                url: element.baseURI,
                innerHtml: element.innerHTML,
                innerText: element.innerText,
                node: element.localName,
                attributes: []
            }
            if (element.attributes) {
                for (var i = 0; i < element.attributes.length; i++) {
                    el[key].attributes[i] = {
                        attribute: element.attributes[i].name,
                        value: element.attributes[i].nodeValue
                    };
                }
            }
            el[numKey].children = DomToArray(element.children);
        }
    }
    return el;
}

var elements = document.querySelectorAll('body > *');
var el = DomToArray(elements);

chrome.runtime.sendMessage({
    action: "getHtmlSource",
    source: el
});