let source = "source;";
let target = "target;";

//Default undefined port.
let port = "0";

//IP address to localhost divided in 4 segments.
let host = "http://127.0.0.1";

//Last synch string. After a synch a date will be displayed
let lastSynch = "Never";

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ "port": port });
    chrome.storage.local.set({ "host": host });
    chrome.storage.local.set({ "lastSynch": lastSynch });
});

chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action == "getHtmlSource") {
        chrome.storage.local.get(null, (data) => {
            var status = data[getOuterHtmlVal.tabId];
            var isSource = (!status.targetRequired || (status.targetRequired && request.source[0].url == status.sourceUrl));
            if (isSource)
                status.documentSource = request.source;
            else
                status.documentTarget = request.source;
            validateProfileValues(status, isSource);
            getOuterHtmlVal = {};
        });
    }
    else if (request.action == "getDomClick") {
        validateClickOnTab(request.source);
    }
});

var activated = false;
chrome.tabs.onActivated.addListener(() => {
    if (!activated) {
        activated = true;
        chrome.tabs.query({}, (tabs) => {
            chrome.storage.local.get(null, (data) => {
                keys = Object.keys(data).filter(key => new RegExp(/^[\d]*$/).test(key));
                if (keys) {
                    for (var key of keys) {
                        if (tabs.filter(tab => tab.id + "" == key).length == 0) {
                            chrome.storage.local.remove(key + "");
                        }
                    }
                }
            });
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.status === "complete") {
        chrome.storage.local.get(null, (data) => {
            status = data[tabId];
            if (status) {
                if (status.sourceUrl == tab.url) {
                    status.tab = tab;
                }
                else if (status.sourceUrl != tab.url && status.targetRequired) {
                    status.tabTarget = tab;
                }
            }
            if (status && changeInfo.active != undefined && !changeInfo.active) {
                stopDiscordActivity(data, status);
            }
            else if (status && changeInfo.active) {
                updateDiscordActivity(status);
            }
            else if (status && status.profile.Audible && tab.audible && status.active != undefined && !status.active) {
                updateDiscordActivity(status);
            }
            else if (status && status.profile.Audible && !tab.audible && status.active) {
                stopDiscordActivity(data, status, !urlFilter(status.profile, tab, !status.targetRequired));
            }
            else if (!status || (status && tab.url == status.sourceUrl)) {
                validateNewActiveTab(data, status, tabId, tab);
            }
            else if (status && tab.url != status.sourceUrl && status.targetRequired && status.sourceReady && urlFilter(status.profile, tab, false)) {
                validateTargetTab(status);
            }
            else if (status && status.active) {
                stopDiscordActivity(data, status, true);
            }
            else if(status) {
                chrome.storage.local.remove(tabId+"");
            }
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (removeInfo.isWindowClosing)
        activated = false;
    chrome.storage.local.get(null, (data) => {
        var status = data[tabId];
        if (status) {
            if (status.active) {
                //Disable Discord activity
            }
            chrome.storage.local.remove(tabId+"");
        }
    });
});

var updateDiscordActivity = function (status, tabId) {
    chrome.storage.local.get(null, (data) => {
        if (status) {
            status.active = false;
            var update = false;
            var keys = Object.keys(data).filter(key => new RegExp(/^[\d]*$/).test(key) && data[key].active);
            if (keys.length > 0) {
                for (var key of keys) {
                    if (data[key].tabId == status.tabId) {
                        update = true;
                        break;
                    }
                }
            }
            else {
                update = true;
            }
        }
        else {
            var keys = Object.keys(data).filter(key => data[key].tabId != tabId && new RegExp(/^[\d]*$/).test(key) && data[key].active != undefined && !data[key].active);
            if (keys.length > 0) {
                update = true;
                var audibleStatus = keys.filter(key => data[key].profile.Audible && ((!data[key].targetRequired && data[key].tab.audible) || data[key].tabTarget.audible));
                if (audibleStatus.length > 0) {
                    status = data[audibleStatus[0]];
                }
                else {
                    status = data[keys[0]];
                }
            }
        }

        if (update) {
            var request = new Request(data.host + ":" + data.port + "/activity");
            var headers = new Headers({
                "Content-Type": "application/json"
            });
            fetch(
                request,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ action: "update", profile: status.profile })
                }
            ).then((response) => {
                if (response.ok) {
                    status.active = true;
                }
                chrome.storage.local.set({ [status.tabId]: status });
            }).catch((error) => {
                chrome.storage.local.set({ [status.tabId]: status });
            });
        }
    });
}

var stopDiscordActivity = (data, status, remove, callback) => {
    if (status && status.active) {
        var request = new Request(data.host + ":" + data.port + "/activity");
        var headers = new Headers({
            "Content-Type": "application/json"
        });
        fetch(
            request,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "stop" })
            }
        ).then((response) => {
            if (response.ok) {
                if (!remove) {
                    status.active = false;
                    chrome.storage.local.set({ [status.tabId]: status }, () => {
                        updateDiscordActivity(undefined, status.tabId);
                        if (callback)
                            callback(undefined, undefined, status.tabId, status.tab);
                    });
                }
                else {
                    chrome.storage.local.remove(status.tabId + "", () => {
                        updateDiscordActivity(undefined, status.tabId);
                        if (callback)
                            callback(undefined, undefined, status.tabId, status.tab);
                    });
                }
                
            }
        });
    }
};

var savePreset = (status) => {
    chrome.storage.local.get(null, (data) => {
        var request = new Request(data.host + ":" + data.port + "/preset");
        var headers = new Headers({
            "Content-Type": "application/json"
        });
        fetch(
            request,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "save", profile: status.profile })
            }
        );
    });
};

var getPreset = (data, status) => {
    var request = new Request(data.host + ":" + data.port + "/preset?" + new URLSearchParams({ key: status.profile.Key }));
    fetch(
        request,
        {
            method: "GET"
        }
    ).then((response) => response.json()
    ).then((json) => {
        status.profile = json;
        status.sourceReady = true;
        validateTargetTab(status);
    });
};

var getOuterHtmlVal = {};

var validateNewActiveTab = function (data, status, tabId, tab) {
    if (status && status.active) {
        stopDiscordActivity(data, status, true, validateNewActiveTab);
    }
    else {
        if (data.profiles) {
            var profile = data.profiles.filter(profile => { return urlFilter(profile, tab, true) });
            if (profile && profile.length > 0) {
                profile = profile[0];
                //Save the current tab
                var status = { profile: profile, tabId: tabId, tab: tab, sourceUrl: tab.url };
                getOuterHtmlVal = { tabId: tabId };
                chrome.storage.local.set({ [tabId]: status }, () => {
                    chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["scripts/getHtmlSource.js"] });
                });
            }
            else {
                profile = data.profiles.filter(profile => { return profile.Key.trim().length > 0 && urlFilter(profile, tab, false) });
                if (profile && profile.length > 0) {
                    profile = profile[0];
                    var oldKey = profile.Key;
                    var fields = Object.keys(profile).filter(key => { return typeof profile[key] == "string" && profile[key].startsWith(target) || key == "Key" });
                    var targetFields = [];
                    for (var field of fields) {
                        targetFields.push({ field: field, value: profile[field] });
                    }
                    var status = { profile: profile, tabId: tabId, tabTarget: tab, targetRequired: true, sourceUrl: "", targetFields: targetFields };
                    profile.Key = validateUrlValue(profile.Key, status, false);
                    profile.Key = validateLocationValue(profile.Key, status, false);
                    if (oldKey != profile.Key) {
                        getPreset(data, status);
                    }
                }
            }
        }
    }
};

var validateTargetTab = (status) => {
    getOuterHtmlVal = { tabId: status.tabTarget.id };
    chrome.storage.local.set({ [status.tabTarget.id]: status }, () => {
        chrome.scripting.executeScript({ target: { tabId: status.tabTarget.id }, files: ["scripts/getHtmlSource.js"] });
    });
};

var urlFilter = function (profile, tab, isSource) {
    var url = tab.url;
    urlFormat = "";
    if (isSource)
        urlFormat = profile.SourceUrl;
    else
        urlFormat = profile.TargetUrl;
    var tempUrl = urlFormat;
    var regexIndex = -1;
    var expressions = [];
    var i = 0;
    do {
        //try to search for an index. Else continue
        regexIndex = tempUrl.indexOf("{::regex:");
        if (regexIndex == -1) break;
        var expression = tempUrl.match(/\{::regex:.*::\}/)[0];
        if (expression) {
            //we make sure that we don't pick multiple regexes. We need only the first we find
            expression = expression.split("::}")[0] + "::}";
            //format the expression to receive the plain pattern
            var pattern = expression.replace("{::regex:", "").replace("::}", "");
            expressions[i] = { "pattern": pattern, expression: expression };
            tempUrl = tempUrl.substring(regexIndex + expression.length);
            i++;
        }
        else {
            regexIndex = -1;
        }
    } while (regexIndex != -1);
    //do a regex match if regex expressions have been found. Else do a string compare
    if (expressions.length > 0) {
        var patternUrl = urlFormat;
        for (var key in expressions) {
            patternUrl = patternUrl.replace(expressions[key].expression, expressions[key].pattern);
        }
        return new RegExp(patternUrl).test(url);
    }
    else {
        return url.trim() == urlFormat.trim();
    }
}

var validateProfileValues = function (status, isSource) {
    var profile = status.profile;
    var targetFields;

    if (isSource)
        targetFields = [];
    else
        targetFields = status.targetFields;

    if (targetFields.length > 0) {
        for (var curField of targetFields) {
            profile[curField.field] = curField.value;
        }
    }

    var keyValidated = false;

    for (var key in profile) {
        var val = profile[key];
        if (key == "TargetUrl" && isSource) {
            if (val.trim().length > 0)
                status.targetRequired = true;
            else
                status.targetRequired = false;
        }
        else if (key == "State" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateUrlValue(val, status, isSource);
            val = validateLocationValue(val, status, isSource);
        }
        else if (key == "Details" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateUrlValue(val, status, isSource);
            val = validateLocationValue(val, status, isSource);
        }
        else if (key == "LargeImage" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateFaviconValue(val, status);
            val = validateLocationValue(val, status, isSource);
        }
        else if (key == "LargeText" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateUrlValue(val, status, isSource);
            val = validateLocationValue(val, status, isSource);
        }
        else if (key == "SmallImage" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateFaviconValue(val, status);
            val = validateLocationValue(val, status, isSource);
        }
        else if (key == "SmallText" && val.startsWith((isSource ? source : target))) {
            val = val.substring((isSource ? source.length : target.length));
            val = validateUrlValue(val, status, isSource);
            val = validateLocationValue(val, status, isSource);
        }
        else if (!isSource && key == "Key") {
            var oldVal = val;
            val = validateUrlValue(val, status, isSource);
            val = validateLocationValue(val, status, isSource);
            if (oldVal != val)
                keyValidated = true;
        }
        else if(isSource && typeof val == "string" && (val.startsWith(target) || key == "Key")) {
            targetFields.push({ field: key, value: val });
        }

        profile[key] = val;
    }
    profile.Url = (isSource ? status.documentSource : status.documentTarget)[0].url;
    status.profile = profile;
    status.targetFields = targetFields;

    var alreadySaved = false;
    if (isSource) {
        status.sourceReady = true;
        if (!status.targetRequired) {
            status.active = false;
            if (!profile.Audible || (profile.Audible && status.tab.audible)) {
                updateDiscordActivity(status);
                alreadySaved = true;
            }
        }
    }
    else {
        status.targetReady = true;
        status.active = false;
        if (!profile.Audible || (profile.Audible && status.tabTarget.audible)) {
            updateDiscordActivity(status);
            alreadySaved = true;
        }
    }

    if (!alreadySaved) {
        chrome.storage.local.set({ [status.tabId]: status }, () => {
            if (isSource)
                chrome.scripting.executeScript({ target: { tabId: status.tabId }, files: ["scripts/setClickOnDom.js"] });
        });
    }

    if (!isSource && keyValidated) {
        savePreset(status);
    }
}

var validateUrlValue = (value, status, isSource) => {
    var origValue = value;
    if (value.includes("{::url::}")) {
        return value.replace("{::url::}", isSource ? status.tab.url : status.tabTarget.url);
    }
    else if (value.includes("{::url:{::regex:")) {
        var url = isSource ? status.tab.url : status.tabTarget.url;
        var tempVal = value;
        var regexIndex = -1;
        var expressions = [];
        var i = 0;
        do {
            regexIndex = tempVal.indexOf("{::url:{::regex:");
            if (regexIndex == -1) break;
            var expression = value.match(/\{::url:\{::regex:.*\::}::\}/)[0];
            if (expression) {
                expression = expression.split("::}::}")[0] + "::}::}";
                var pattern = new RegExp(expression.replace("{::url:{::regex:", "").replace(/::\}::\}$/, ""));
                expressions[i] = { expression: expression, pattern: pattern };
                tempVal = tempVal.substring(regexIndex + expression.length);
                i++;
            }
            else {
                regexIndex = -1;
            }
        } while (regexIndex != -1);
        if (expressions.length > 0) {
            try {
                for (var key in expressions) {
                    value = value.replace(expressions[key].expression, url.match(expressions[key].pattern)[0]);
                }
            } catch (err) {
                value = origValue;
            }
            return value;
        }
        else {
            return value;
        }
    }
    else {
        return value;
    }
};

var validateFaviconValue = (value, status) => {
    var origValue = value;
    if (value.includes("{::favicon::}")) {
        return value.replace("{::favicon::}", status.tab.favIconUrl);
    }
    else {
        return origValue;
    }
};

var validateLocationValue = (value, status, isSource) => {
    var origValue = value;
    var expression = value.match(/\{::location:.*::\}/);
    if (expression) {
        expression = expression[0];
        var element = expression.replace("{::location:", "").replace(/::\}$/, "");
        var indexStart = element.indexOf("<");
        var indexEnd = element.indexOf(">");
        if (indexStart == -1 || indexEnd == -1) return origValue;
        var curElement = element.substring(indexStart, indexEnd + 1);
        var tag = separateHtmlTag(curElement);
        var document;
        if (isSource)
            document = status.documentSource;
        else
            document = status.documentTarget;
        var el = getElementOfPosition(findPosition(status, tag, isSource), 0, document);
        if (el) {
            element = element.substring(curElement.length);
            if (element.startsWith(":")) {
                key = element.substring(1);
                var regex = "";
                if (new RegExp(/^.*:\{::regex:.*::\}/).test(key)) {
                    regex = key.match(/:\{::regex:.*::\}/)[0];
                    key = key.replace(regex, "");
                    regex = regex.replace(":{::regex:", "").replace("::}");
                }
                var attribute = el.attributes.filter(attr => attr.attribute == key);
                if (attribute.length > 0) {
                    attribute = attribute[0];
                    if (regex.length > 0) {
                        attribute.value = attribute.value.match(new RegExp(regex));
                        if (attribute.value.length > 0) {
                            return value.replace(expression, attribute.value[0]);
                        }
                        else {
                            return value;
                        }
                    }
                    else {
                        return value.replace(expression, attribute.value);
                    }
                }
                else {
                    return value;
                }
            }
            else {
                return value.replace(expression, el.innerText);
            }
        }
        else {
            return origValue;
        }
    }
    else {
        return origValue;
    }
};

var validateClickOnTab = (event) => {
    chrome.storage.local.get(null, (data) => {
        if (data) {
            var status = Object.keys(data).filter(key => data[key].sourceUrl && data[key].sourceUrl == event.url);
            if (status.length > 0) {
                status = data[status[0]];
                var fields = Object.keys(status.profile).filter(key => new RegExp(/^.*\{::click:.*::\}.*$/).test(status.profile[key]));
                for (var key of fields) {
                    if (!status.profile[key].startsWith(source) && !status.profile[key].startsWith(target))
                        status.profile[key] = formatClickField(key, status, event);
                }
                chrome.storage.local.set({ [status.tabId]: status });
            }
        }
    });
};

var formatClickField = (key, status, event) => {
    var field = status.profile[key];
    var expression = field.match(/\{::click:.*::\}/)[0];
    var elements = expression.replace("{::click:", "").replace(/::\}$/, "");
    var indexStart = -1;
    var indexEnd = -1;
    var positions = [];
    var curElement = "";

    indexStart = elements.indexOf("<");
    indexEnd = elements.indexOf(">");
    if (indexStart == -1 || indexEnd == -1)
        return field;
    curElement = elements.substring(indexStart, indexEnd + 1);
    var tag = separateHtmlTag(curElement);

    if (compareTagWithDom(tag, event))
        positions = findPosition(status, event, true);

    if (positions.length > 0) {
        elements = elements.substring(curElement.length);
        var el = undefined;

        do {
            indexStart = elements.indexOf("<");
            indexEnd = elements.indexOf(">");
            if (indexStart == -1 || indexEnd == -1) break;
            curElement = elements.substring(indexStart, indexEnd + 1);

            if (elements.startsWith("up")) {
                elements = elements.substring("up".length);
                positions.pop();
                el = getElementOfPosition(positions, 0, status.documentSource);
                var tag = separateHtmlTag(curElement);
                if (!compareTagWithDom(tag, el)) {
                    return field;
                }
            }
            else if (elements.startsWith("down")) {
                elements = elements.substring("down".length);
                var tag = separateHtmlTag(curElement);
                el = getElementOfChildrenPosition(positions, 0, tag, status.documentSource);
                if (el) {
                    positions[positions.length] = el.position;
                }
                else {
                    return field;
                }
            }
            elements = elements.substring(curElement.length);
        } while (indexStart != -1 && indexEnd != -1);

        if (el) {
            if (elements.startsWith(":")) {
                var key = elements.substring(1);
                var regex = "";
                if (new RegExp(/^.*:\{::regex:.*::\}/).test(key)) {
                    regex = key.match(/:\{::regex:.*::\}/)[0];
                    key = key.replace(regex, "");
                    regex = regex.replace(":{::regex:", "").replace("::}");
                }
                var attribute = el.attributes.filter(attr => attr.attribute == key);
                if (attribute.length > 0) {
                    attribute = attribute[0];
                    if (regex.length > 0) {
                        attribute.value = attribute.value.match(new RegExp(regex));
                        if (attribute.value.length > 0) {
                            return field.replace(expression, attribute.value[0]);
                        }
                        else {
                            return field;
                        }
                    }
                    else {
                        return field.replace(expression, attribute.value);
                    }
                }
                else {
                    return field;
                }
            }
            else {
                return field.replace(expression, el.innerText);
            }
        }
        else {
            return field;
        }
    }
    else {
        return field;
    }
};

var findPosition = function (status, event, isSource) {
    var dom = isSource ? status.documentSource : status.documentTarget;
    var index = getPosition(0, [], dom, event);
    return (index ? index : []);
};

var getPosition = function (index, array, dom, event) {
    for (var i = 0; i < dom.length; i++) {
        array[index] = i;
        var el = dom[i];
        if (el.node == event.node && event.innerText && el.innerText.trim() == event.innerText.trim()) {
            var valid = true;
            for (var key in el.attributes) {
                if (event.attributes.filter(attr => el.attributes[key].attribute == attr.attribute && el.attributes[key].value == attr.value).length == 0) {
                    valid = false;
                    break;
                }
            }
            if (valid)
                return array;
        }
        else if (el.node == event.node && !event.innerText) {
            var valid = true;
            for (var key in event.attributes) {
                if (el.attributes.filter(attr => event.attributes[key].attribute == attr.attribute && (!event.attributes[key].value || (!event.attributes[key].isRegex && event.attributes[key].value == attr.value) || (event.attributes[key].isRegex && new RegExp(event.attributes[key].value).test(attr.value)))).length == 0) {
                    valid = false;
                    break;
                }
            }
            if (valid)
                return array;
        }
        if (el.children.length > 0) {
            var val = getPosition(index + 1, array, el.children, event);
            if (val) {
                return val;
            }
            else {
                array.pop();
            }
        }
    }
    return undefined;
};

var getElementOfPosition = function (positions, index, dom) {
    var position = positions[index];
    if (index + 1 < positions.length) {
        return getElementOfPosition(positions, index + 1, dom[position].children);
    }
    else {
        return dom[position];
    }
};

var getElementOfChildrenPosition = function (positions, index, tag, dom) {
    var position = positions[index];
    if (index < positions.length) {
        return getElementOfChildrenPosition(positions, index + 1, tag, dom[position].children);
    }
    else {
        var count = 0;
        for (var el of dom) {
            if (compareTagWithDom(tag, el)) {
                el.position = count;
                return el;
            }
            count++;
        }
        return undefined;
    }
};

var separateHtmlTag = function (element) {
    element = element.replaceAll(/[<>]/g, "");
    var values = element.split(" ");
    var tag = {};
    tag.node = values[0];

    var tempAttribute = "";
    var tempValue = "";
    for (var i = 1; i < values.length; i++) {
        if (values[i].includes("=")) {
            var array = values[i].split("=");
            tempAttribute = array[0];
            tempValue = array[1];
        }
        else if (tempValue.length > 0 && !tempValue.endsWith("\"")) {
            tempValue = tempValue + " " + values[i];
        }
        else {
            tempAttribute = values[i];
        }
        if ((tempAttribute.length > 0 && tempValue.length == 0) || (tempValue.length > 0 && tempValue.endsWith("\""))) {
            var isRegex = false;
            if (tempValue != null) {
                tempValue = tempValue.replaceAll("\"", "");
                isRegex = new RegExp(/\{::regex:.*::\}/).test(tempValue);
                if (isRegex)
                    tempValue = tempValue.replace("{::regex:", "").replace("::}", "");
            }

            if (tag.attributes) {
                tag.attributes[tag.attributes.length] = {
                    attribute: tempAttribute,
                    value: (tempValue.length > 0 ? tempValue : null),
                    isRegex: isRegex
                };
            }
            else {
                tag.attributes = [{
                    attribute: tempAttribute,
                    value: (tempValue.length > 0 ? tempValue : null),
                    isRegex: isRegex
                }];
            }
            tempAttribute = "";
            tempValue = "";
        }
    }

    if (!tag.attributes)
        tag.attributes = [];

    return tag;
};

var compareTagWithDom = function (tag, event) {
    if (tag.node == event.node) {
        var valid = true;
        for (var attribute of tag.attributes) {
            if (event.attributes.filter(attr => attr.attribute == attribute.attribute && (attribute.value == null || (!attribute.isRegex && attr.value == attribute.value) || (attribute.isRegex && new RegExp(attribute.value).test(attr.value)))).length > 0) {
                valid = true;
            }
            else {
                valid = false;
                break;
            }
        }
        return valid;
    }
    return false;
};