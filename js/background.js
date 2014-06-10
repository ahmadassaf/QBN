console.log("====== QBN Background is in Action !!! =======");

//initializing the default options
var defaults = { intents: true, scroll: true, https: true };

window.QBN = {

    checkForValidUrl: function(url)
    {
        var badWords = ["chrome://"];
        for (var b = 0; b < badWords.length; b++)
            if (url.indexOf(badWords[b]) > -1) return false;
        if (!window.QBN.settings.allowOnHttps) return url.indexOf("https") === -1;
        return true;
    },

    updateSettings: function()
    {
        is_QBN_in_action = true;
        chrome.storage.sync.get("data", function(options)
        {
            if (options && !jQuery.isEmptyObject(options))
            {
                var settings = defaults;
                $.each(options.data.data, function(key, value)
                {
                    if (value.id == "intents") settings.intents = value.value;
                    else if (value.id == "scroll") settings.scroll = value.value;
                    else if (value.id == "https") settings.https = value.value;
                });
                window.QBN.settings = settings;
            }
            else console.log("First Run !! Settings are Default ");
            window.QBN.sendRequest("build");
        });
    },

    sendRequest: function(request)
    {
        chrome.tabs.getSelected(null, function(tab)
        {
            if (window.QBN.checkForValidUrl(tab.url))
            {
                port = chrome.tabs.connect(tab.id);
                switch (request) {
                    case "build" : port.postMessage({message: "buildNotification", url:tab.url}); break;
                }
                port.onMessage.addListener(function getResp(response) {
                    console.log(response);
                });
            }
            else console.log("ERROR HAPPENED ON: " + tab.url);
        });
    },
    settings: defaults
};


chrome.browserAction.onClicked.addListener(function(tab)
{
    window.QBN.updateSettings();
});