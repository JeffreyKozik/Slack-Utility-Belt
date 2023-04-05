// debug mode
let debug_mode = true;
function dc(log){
    if(debug_mode){
        console.log(log);
    }
}
// THE RULE
var rule =
    {
        "id": 1,
        "priority": 1,
        "action": {"type": "block"},
        "condition": {
            "urlFilter": "*://*.slack.com/api/chat.postMessage*",
            "resourceTypes": [ "main_frame", "sub_frame",
                               "stylesheet", "script", "image",
                               "font", "xmlhttprequest", "ping",
                                "media", "websocket", "other"]
        }
    };
var rule2 =
    {
        "id": 2,
        "priority": 1,
        "action": {"type": "block"},
        "condition": {
            "urlFilter": "*://*.slack.com/api/files.share*",
            "resourceTypes": [ "main_frame", "sub_frame",
                               "stylesheet", "script", "image",
                               "font", "xmlhttprequest", "ping",
                                "media", "websocket", "other"]
        }
    };
// getting current tab
function updateValues(request_url){
    dc("updating values");
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var port = chrome.tabs.connect(
            tabs[0].id,
            {
                name: "getCurrentUrl"
            }
        );
        port.postMessage({});
        port.onMessage.addListener(async function(response) {
            let currentURL = response.currentURL;
            // parsing current url into workspaceID and channelID
            let currentURLArray = currentURL.split("/");
            let workspaceID = currentURLArray[4];
            let channelID = currentURLArray[5];

            // setting the channel status to false (no rule) or retrieving the status
            // from storage. Displays current status on frontend of popup
            let statusKey = "workspaceID" + workspaceID + "channelID" + channelID + "status";
            function getStatusValuePromise(){
                return new Promise((resolve) => {
                    chrome.storage.sync.get([statusKey], async function(result) {
                        if (result[[statusKey]] == null) {
                            chrome.storage.sync.set({[statusKey]: false}); // set chrome storage to no rule
                            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2] }); // set chrome request rules to none
                        } else {
                            if(result[[statusKey]]){
                                dc("status is on");
                                // add the new rule if the status is on
                                await chrome.declarativeNetRequest.updateDynamicRules({addRules: [ rule, rule2 ], removeRuleIds: [1, 2]});
                                // if a chat is being sent and it's the first try
                                if((request_url.includes("chat.postMessage") || request_url.includes("files.share")) && !(request_url.includes("retry_attempt"))){
                                    dc("first chat attempt");
                                    // make the popup appear
                                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                                        dc ("areYouSure? port activated");
                                        var port = chrome.tabs.connect(
                                            tabs[0].id,
                                            {
                                                name: "areYouSure?"
                                            }
                                        );
                                        port.postMessage({});
                                        port.onMessage.addListener(async function(response) {
                                        });
                                    });
                                    // if the last retry attempt is done close the popup automatically
                                } else if((request_url.includes("chat.postMessage") || request_url.inclues("files.share")) && (request_url.includes("retry_attempt=2"))){
                                    await chrome.declarativeNetRequest.updateDynamicRules({addRules: [ rule, rule2 ], removeRuleIds: [1, 2]});
                                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                                        var port = chrome.tabs.connect(
                                            tabs[0].id,
                                            {
                                                name: "closePopup"
                                            }
                                        );
                                        port.postMessage({});
                                        port.onMessage.addListener(async function(response) {
                                            var port = chrome.runtime.connect({name: "updateSnooze"}); // update snooze
                                            port.postMessage({});
                                            port.onMessage.addListener(async function(response) {});
                                        });
                                    });
                                }
                            } else {
                                // if the storage says there's no rule remove it from request rules
                                await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2] });
                            }
                        }
                    });
                    resolve("resolved");
                });
            }
            await getStatusValuePromise();
        });
    });
}
// when message is sent, channel is changed, or page is reloaded
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            dc("in on before request");
            var port = chrome.tabs.connect(
                tabs[0].id,
                {
                    name: "updateSnooze"
                }
            );
            port.postMessage({});
            port.onMessage.addListener(async function(response) {
                dc("done updating snooze");
                updateValues(details.url);
            });
        });
    },
    {urls: ["*://*.slack.com/api/chat.postMessage*", "*://*.slack.com/api/files.share*", "*://*.slack.com/api/channels.prefs.get*", "*://*.slack.com/client/*/*"]}
);
// when extension is installed it removes all previous storage
chrome.runtime.onInstalled.addListener(function (object) {
    if(object.reason === 'install'){
        chrome.declarativeNetRequest.getDynamicRules(
            async function(rules){
                for(let i = 0; i < rules.length; i++){
                    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [rules[i]["id"]] });
                }
            }
        )
    }
});
// chrome request rules are removed
chrome.runtime.onConnect.addListener(function(port) {
  if(port.name === "removeRulesCauseICant"){
      port.onMessage.addListener(async function(msg) {
          await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2] });
          port.postMessage({response: "done"});
      });
  }
});
