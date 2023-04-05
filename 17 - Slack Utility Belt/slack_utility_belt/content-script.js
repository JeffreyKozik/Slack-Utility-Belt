// debug mode
let debug_mode = true;
function dc(log){
    if(debug_mode){
        console.log(log);
    }
}
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
// workspace name
function getWorkspaceName(){
    let workspaceNameSpan = document.getElementsByClassName("p-ia__sidebar_header__team_name_text")[0];
    let workspaceName = workspaceNameSpan.innerHTML;
    return workspaceName;
}
// channel name
function getChannelName(channelID){
    let channelNameDiv = document.getElementById(channelID);
    let channelNameDivChild = channelNameDiv.children[0];
    let channelNameSpan = channelNameDivChild.children[1];
    let channelName = channelNameSpan.innerHTML;
    return channelName;
}
// getting workspace name and channel name
chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === "getNames"){
        port.onMessage.addListener(function(request) {
            while(true){
                try {
                    let workspaceName = getWorkspaceName();
                    let channelID = request.channelID;
                    let channelName = getChannelName(channelID);
                    // sending the workspace and channel names to the popup
                    port.postMessage({
                        workspaceName: workspaceName,
                        channelName: channelName
                    });
                    break;
                } catch(error){
                    dc("error: " + error);
                }
            }
        });
    }
});
// get the url of the tab you're on
chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === "getCurrentUrl"){
        port.onMessage.addListener(function(request) {
            while(true){
                try {
                    let currentURL = location.href;
                    port.postMessage({
                        currentURL: currentURL
                    });
                    break;
                } catch (error) {
                    dc("error: " + error);
                }
            }
        });
    }
});
// what happens when you try to send a message but you have a rule on for that channel
chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === "areYouSure?"){
        port.onMessage.addListener(function(request) {
            dc("content script agrees that areYouSure? port is activated");
            // workspace name
            let workspaceName = getWorkspaceName();

            let currentURL = location.href;
            let currentURLArray = currentURL.split("/");
            let workspaceID = currentURLArray[4];
            let channelID = currentURLArray[5];
            // channel name
            let channelName = getChannelName(channelID);

            let statusKey = "workspaceID" + workspaceID + "channelID" + channelID + "status";

            let body = document.getElementsByTagName("body")[0];
            let popup_box = document.createElement("div");
            popup_box.style.top = "25%";
            popup_box.style.left = "25%";
            popup_box.style.position = "absolute";
            popup_box.style.zIndex = "1000000";
            popup_box.style.backgroundColor = "gray";
            popup_box.style.color = "black";
            popup_box.style.width = "50%";
            popup_box.style.height = "50%";
            popup_box.id = "popup_box_extension";
            let question = document.createElement("div");
            question.innerHTML = "You're in the " + channelName.toUpperCase() + " channel! Your message is pending, are you sure you want to send?";
            question.style.color = "black";
            popup_box.appendChild(question);
            let yesButton = document.createElement("button");
            yesButton.type = "button";
            yesButton.style.backgroundColor = "white";
            yesButton.style.color = "black";
            yesButton.innerHTML = "SEND";
            popup_box.appendChild(yesButton);
            let noButton = document.createElement("button");
            noButton.type = "button";
            noButton.style.backgroundColor = "red";
            noButton.style.color = "black";
            noButton.innerHTML = "CANCEL";
            popup_box.appendChild(noButton);
            let snoozeButton = document.createElement("button");
            snoozeButton.type = "button";
            snoozeButton.style.backgroundColor = "yellow";
            snoozeButton.style.color = "black";
            snoozeButton.innerHTML = "SEND & SNOOZE";
            popup_box.appendChild(snoozeButton);
            let snoozeInput = document.createElement("input");
            snoozeInput.style.backgroundColor = "yellow";
            snoozeInput.style.color = "black";
            snoozeInput.placeholder = "# hours";
            popup_box.appendChild(snoozeInput);
            body.appendChild(popup_box);

            async function yes(){
                body.removeChild(popup_box); // remove the popup box
                // chrome storage says this channel has no rule
                chrome.storage.sync.set({[statusKey]: false});
                // chrome request rules are removed
                var port = chrome.runtime.connect({name: "removeRulesCauseICant"});
                port.postMessage({});
                port.onMessage.addListener(function(msg) {
                    // chrome storage says this channel does have a rule
                    chrome.storage.sync.set({[statusKey]: true});
                });
            }
            async function no(){
                body.removeChild(popup_box); // remove the popup box
            }
            async function snooze(){
                body.removeChild(popup_box); // remove the popup box
                // chrome storage says this channel has no rule
                chrome.storage.sync.set({[statusKey]: false});
                // chrome request rules are removed
                var port = chrome.runtime.connect({name: "removeRulesCauseICant"});
                port.postMessage({});
                port.onMessage.addListener(function(msg) {});
                let snoozeKey = "workspaceID" + workspaceID + "channelID" + channelID + "endTime";
                let currentTime = new Date();
                let numHours = snoozeInput.value;
                let endTime = new Date(currentTime.getTime() + numHours*3600000);
                chrome.storage.sync.set({[snoozeKey]: endTime.toString()}); // set snooze time
            }
            yesButton.addEventListener('click', yes);
            noButton.addEventListener('click', no);
            snoozeButton.addEventListener('click', snooze);
        });
        port.postMessage({response: "done"});
    }
});
// remove popup if the last request to try to send the chat has happened
chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === "closePopup"){
        port.onMessage.addListener(function(request) {
            let body = document.getElementsByTagName("body")[0];
            body.removeChild(document.getElementById("popup_box_extension"));
        });
        port.postMessage({response: "done"});
    }
});
// from other js files: update the snooze values and the status values with respect to the snooze values
chrome.runtime.onConnect.addListener(function(port) {
  dc("about to update snooze");
  if(port.name === "updateSnooze"){
      dc("updating snooze on content script");
      port.onMessage.addListener(async function(msg) {
          // parsing current url into workspaceID and channelID
          let currentURL = location.href;
          let currentURLArray = currentURL.split("/");
          let workspaceID = currentURLArray[4];
          let channelID = currentURLArray[5];
          function getSnoozePromise(workspaceID, channelID){
              let statusKey = "workspaceID" + workspaceID + "channelID" + channelID + "status";
              let snoozeKey = "workspaceID" + workspaceID + "channelID" + channelID + "endTime";
              return new Promise((resolve) => {
                  chrome.storage.sync.get([snoozeKey], async function(result) {
                      if (result[[snoozeKey]] == null || result[[snoozeKey]] == "") {
                          chrome.storage.sync.set({[snoozeKey]: ""});
                      }  else {
                          let rightNow = new Date();
                          let snoozedTime = Date.parse(result[[snoozeKey]]);
                          // if we've chronologically passed the snoozed time
                          if(snoozedTime < rightNow){
                              chrome.storage.sync.set({[statusKey]: true}); // it should be saved in storage the rule is back
                              await chrome.declarativeNetRequest.updateDynamicRules({addRules: [ rule, rule2 ], removeRuleIds: [1, 2]}); // request rule should be added
                              chrome.storage.sync.set({[snoozeKey]: ""}); // storage: snooze is off
                          }
                      }
                  });
                  resolve("resolved");
              });
          };
          await getSnoozePromise(workspaceID, channelID);
      });
      port.postMessage({response: "done"});
  }
});
