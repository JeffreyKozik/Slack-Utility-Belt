// debug mode
let debug_mode = true;
function dc(log){
    if(debug_mode){
        console.log(log);
    }
}
// THE rule
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
// update the snooze values and the status values with respect to the snooze values
function getSnoozePromise(workspaceID, channelID){
    let statusKey = "workspaceID" + workspaceID + "channelID" + channelID + "status";
    let snoozeKey = "workspaceID" + workspaceID + "channelID" + channelID + "endTime";
    let snoozeCell = document.getElementById("current_snooze");
    let statusInput = document.getElementById("input");
    return new Promise((resolve) => {
        chrome.storage.sync.get([snoozeKey], async function(result) {
            if (result[[snoozeKey]] == null || result[[snoozeKey]] == "") {
                chrome.storage.sync.set({[snoozeKey]: ""});
            }  else {
                snoozeCell.innerHTML = result[[snoozeKey]];
                let rightNow = new Date();
                let snoozedTime = Date.parse(result[[snoozeKey]]);
                // if we've chronologically passed the snoozed time
                if(snoozedTime < rightNow){
                    chrome.storage.sync.set({[statusKey]: true}); // it should be saved in storage the rule is back
                    await chrome.declarativeNetRequest.updateDynamicRules({addRules: [ rule, rule2 ], removeRuleIds: [1, 2]}); // request rule should be added
                    statusInput.checked = true; // popup should display rule as back on
                    chrome.storage.sync.set({[snoozeKey]: ""}); // storage: snooze is off
                }
            }
        });
        chrome.storage.sync.get([statusKey], async function(result) {
            if(result[[statusKey]] == null || result[[statusKey]] == false){
                snoozeCell.innerHTML = "Snoozed"; // it should be displayed that snooze is on
            } else {
                snoozeCell.innerHTML = "Enabled"; // it should be displayed that snooze is off
            }
        });
        resolve("resolved");
    });
};
// update the snooze values and the status values with respect to the DOM
async function updateStatusAndSnooze(statusInput, snoozeKey, snoozeCell){
    if(statusInput.checked){ // if a rule is enabled
        chrome.storage.sync.set({[snoozeKey]: ""}); // then storage you aren't snoozed
        await chrome.declarativeNetRequest.updateDynamicRules({addRules: [ rule, rule2 ], removeRuleIds: [1, 2]}); // add request rule
        snoozeCell.innerHTML = "Enabled"; // then display not snoozed
    } else { // if a rule isn't enabled
        await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: [1, 2]}); // remove request rule
        snoozeCell.innerHTML = "Snoozed"; // then display not snoozed
    }
}
// getting current tab
chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    // parsing current url into workspaceID and channelID
    let currentURL = tabs[0].url;
    let currentURLArray = currentURL.split("/");
    let workspaceID = currentURLArray[4];
    let channelID = currentURLArray[5];

    // getting workspace name and channel name using content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var port = chrome.tabs.connect(
            tabs[0].id,
            {
                name: "getNames"
            }
        );
        port.postMessage({
            channelID: channelID
        });
        port.onMessage.addListener(async function(response) {
            let workspaceName = response.workspaceName;
            let channelName = response.channelName;
            // saving workspaceName and channelName to storage to display on the frontend
            let workspaceNameKey = "workspaceID" + workspaceID + "channelID" + channelID + "workspaceName";
            chrome.storage.sync.set({[workspaceNameKey]: workspaceName});
            let channelNameKey = "workspaceID" + workspaceID + "channelID" + channelID + "channelName";
            chrome.storage.sync.set({[channelNameKey]: channelName});

            // clearing the rules table
            let rulesTable = document.getElementById("rules");
            rulesTable.innerHTML = '';

            // rules table header
            let headerRow = document.createElement("tr");
            let workspaceHeader = document.createElement("th");
            workspaceHeader.innerHTML = "Workspace";
            let channelHeader = document.createElement("th");
            channelHeader.innerHTML = "Channel";
            let statusHeader = document.createElement("th");
            statusHeader.innerHTML = "Status";
            rulesTable.appendChild(workspaceHeader);
            rulesTable.appendChild(channelHeader);
            rulesTable.appendChild(statusHeader);
            rulesTable.appendChild(headerRow);

            // current channel rule row
            let currentRuleRow = document.createElement("tr");
            currentRuleRow.id = "current_rule";
            rulesTable.appendChild(currentRuleRow);
            // current channel workspace name
            let currentWorkspaceCell = document.createElement("td");
            currentWorkspaceCell.id = "current_workspace";
            currentWorkspaceCell.innerHTML = workspaceName;
            currentRuleRow.appendChild(currentWorkspaceCell);
            // current channel channel name
            let currentChannelCell = document.createElement("td");
            currentChannelCell.id = "current_channel";
            currentChannelCell.innerHTML = channelName;
            currentRuleRow.appendChild(currentChannelCell);
            // current channel status
            let currentStatusCell = document.createElement("td");
            currentStatusCell.id = "current_status";
            currentRuleRow.appendChild(currentStatusCell);
            let statusLabel = document.createElement("label");
            statusLabel.className = "switch";
            let statusInput = document.createElement("input");
            statusInput.type = "checkbox";
            statusInput.id = "input";
            let statusSpan = document.createElement("span");
            statusSpan.className = "slider round";
            statusLabel.appendChild(statusInput);
            statusLabel.appendChild(statusSpan);
            currentStatusCell.appendChild(statusLabel);
            // current channel snooze
            let snoozeKey = "workspaceID" + workspaceID + "channelID" + channelID + "endTime";
            let snoozeCell = document.createElement("td");
            snoozeCell.id = "current_snooze";
            snoozeCell.innerHTML = "";
            currentRuleRow.appendChild(snoozeCell);

            // when the popup is opened the snooze and status are updated with respect to the snooze
            await getSnoozePromise(workspaceID, channelID);

            // setting the channel status to false (no rule) or retrieving the status
            // from storage. Displays current status on frontend of popup
            // also updates snooze with respect to status
            let statusKey = "workspaceID" + workspaceID + "channelID" + channelID + "status";
            function getStatusValuePromise(){
                return new Promise((resolve) => {
                    chrome.storage.sync.get([statusKey], async function(result) {
                        if (result[[statusKey]] == null) {
                            chrome.storage.sync.set({
                                [statusKey]: false
                            });
                            statusInput.checked = false;
                        } else {
                            statusInput.checked = result[[statusKey]];
                            updateStatusAndSnooze(statusInput, snoozeKey, snoozeCell);
                        }
                    });
                    resolve("resolved");
                });
            }
            await getStatusValuePromise(); // when the popup is opened the status is updated

            // saves the status value to storage every time it's updated
            // and updates snooze with respect to the DOM as well
            async function updateStatusKeyValue(){
                chrome.storage.sync.set({[statusKey]: statusInput.checked});
                updateStatusAndSnooze(statusInput, snoozeKey, snoozeCell);
            }
            statusInput.addEventListener('click', updateStatusKeyValue);
        });
    });
});
