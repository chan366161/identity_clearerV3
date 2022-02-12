//
let getLocalStorage = (objs) => new Promise(function (resolve, reject) {
    chrome.storage.local.get(objs, (data) => resolve(data))
});
let setLocalStorage = (obj) => new Promise(function (resolve, reject) {
    chrome.storage.local.set(obj, () => resolve())
});
let setExtensionIcon = (img) => new Promise(function (resolve, reject) {
    chrome.action.setIcon(img, () => resolve())
});
let setExtensionTitle = (obj) => new Promise(function (resolve, reject) {
    chrome.action.setTitle(obj, () => resolve())
});
let setCookie = (cookie) => new Promise(function (resolve, reject) {
    chrome.cookies.set(cookie, val => {if (val) resolve(val) ; else { console.log(chrome.runtime.lastError.message); throw chrome.runtime.lastError} })
});
let getCookie = (pattern) => new Promise(function (resolve, reject) {
    chrome.cookies.getAll(pattern, (res) => resolve(res))
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCurrentTab() {
    let queryOptions = {active: true, currentWindow: true};
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

function removeCookiesByCriteria(criteria) {
    return new Promise(async function (resolve, reject) {
        let regex = /^\./;
        let cookies = await getCookie(criteria);
        let valuesOfCookieRemoved = [];
        for (let i in cookies) {
            let cookie = cookies[i];
            let domain = cookie.domain.replace(regex, '');
            let url = "http" + (cookie.secure ? "s" : "") + "://" + domain + cookie.path;
            valuesOfCookieRemoved[i] = cookie.value;
            await chrome.cookies.remove({
                "url": url,
                "name": cookie.name,
                "storeId": cookie.storeId,
            });
        }
        resolve(valuesOfCookieRemoved)
    })
}

let UIDQueryPattern = {"name": "uid", "domain": ".medium.com"};
let SIDQueryPattern = {"name": "sid", "domain": ".medium.com"};
let EndUIDQueryPattern = {"name": "optimizelyEndUserId", "domain": ".medium.com"};

async function backupLoginTrack() {
    let isfulfilled = false;
    let data = await getLocalStorage(['loginTrack']);
    if (data.loginTrack === "unknown" || data.loginTrack === "updating") {
        let uidcookies = null;
        let sidcookies = null;
        let enduidcookies = null;
        let regex = /^\./;
        await getCookie(UIDQueryPattern)
            .then((res) => {
                uidcookies = res;
                return getCookie(SIDQueryPattern)
            })
            .then((res) => {
                sidcookies = res;
                return getCookie(EndUIDQueryPattern)
            })
            .then(async (res) => {
                enduidcookies = res;
                let uidcookie = null;
                let sidcookie = null;
                if (uidcookies.length > 0) {
                    delete uidcookies[0].hostOnly;
                    delete uidcookies[0].session;
                    let domain=uidcookies[0].domain.replace(regex,'');
                    uidcookies[0].url = "http" + (uidcookies[0].secure ? "s" : "") + "://" + domain + uidcookies[0].path ;
                    uidcookie = uidcookies[0];
                }
                if ( uidcookie != null && !(/^lo/.test(uidcookie.value))) {
                    if (sidcookies.length > 0) {
                        delete sidcookies[0].hostOnly;
                        delete sidcookies[0].session;
                        let domain=sidcookies[0].domain.replace(regex,'');
                        sidcookies[0].url = "http" + (sidcookies[0].secure ? "s" : "") + "://" + domain + sidcookies[0].path  ;
                        sidcookie = sidcookies[0];
                    }
                    await setLocalStorage({uid: uidcookie, sid: sidcookie});
                    isfulfilled = true;
                }
            });
    }
    return isfulfilled;
}

//pageFingerPrintLevel1 = '<meta data-rh="true" property="og:site_name" content="Medium">';
function checkCookiesAvailable() {
    if (document.querySelector("meta[data-rh='true'][property='og:site_name'][content='Medium']"))
        return "backupsession";
    else
        return "skipbackup";
}

let criterias = [{"name": "optimizelyEndUserId","domain": ".medium.com"}, {"name":"uid","domain":".medium.com"}, {"name": "_s", "domain": ".app.link"}];
async function customcriterias(){
    let domainqueryoption={"name":"vary","value":"enable_medium_app"};
    let ruletemplate={"name":"uid"};
    let cookies=await getCookie({"name":domainqueryoption.name});
    let allcriterias=[];
    for (let i in cookies){
        if (cookies[i].value===domainqueryoption.value) {
            let criteria=Object.create(ruletemplate);
            criteria.domain=cookies[i].domain;
            allcriterias.push(criteria);
        }
    }
    cookies=await getCookie({"name": "_ga"});
    for (let i in cookies){
        if (cookies[i].domain!=".medium.com") {
            let criteria=Object.create(ruletemplate);
            let regex = /^\./;
            criteria.domain=cookies[i].domain.replace(regex, '');
            allcriterias.push(criteria)
        }
    }
    allcriterias.push.apply(allcriterias,criterias);
    return allcriterias
}
let LOCK = false;

async function updateIcon() {
    if (!LOCK) {
        LOCK = true;
        let data = await getLocalStorage('status');
        let current = data.status;
        let iconName = '';
        let trackprocessstate = await getLocalStorage(["loginTrack"]);
        if (current === "running") {
            current = "suspended";
            iconName = 'images/light_cookie_16.png';
            if (trackprocessstate.loginTrack === "dumped") {
                await getLocalStorage(['uid', 'sid'])
                    .then(async (iddata) => {
                        if (iddata.uid != null)
                            await setCookie(iddata.uid)
                                .then(async (res) => {
                                    if (iddata.sid != null) {
                                        await setCookie(iddata.sid)
                                            .then((res) => setLocalStorage({status: current}))
                                            .then(() => setExtensionIcon({path: iconName}))
                                            .then(() => setExtensionTitle({title: "Identity Clearer is " + current}));
                                    } else {
                                        await setLocalStorage({status: current})
                                            .then(() => setExtensionIcon({path: iconName}))
                                            .then(() => setExtensionTitle({title: "Identity Clearer is " + current}));
                                    }
                                });
                        else if (iddata.sid != null)
                            await setCookie(iddata.sid)
                                .then((res) => setLocalStorage({status: current}))
                                .then(() => setExtensionIcon({path: iconName}))
                                .then(() => setExtensionTitle({title: "Identity Clearer is " + current}));
                    })
            } else {
                await setLocalStorage({status: current})
                    .then(() => setExtensionIcon({path: iconName}))
                    .then(() => setExtensionTitle({title: "Identity Clearer is " + current}));
            }

        } else if (current === "suspended") {
            current = "running";
            iconName = 'images/dark_cookie_16.png';
            if (trackprocessstate.loginTrack === "dumped")
                await setLocalStorage({loginTrack: "updating"})

            await new Promise(async (resolve, reject) => {
                let currenttab = await getCurrentTab();
                await chrome.scripting.executeScript({
                    target: {tabId: currenttab.id},
                    func: checkCookiesAvailable,
                })
                    .then(async (injectResults) => {
                        let trackprocessstate = await getLocalStorage(["loginTrack"]);
                        if (injectResults[0].result === "backupsession") {
                            let isfulfilled = await backupLoginTrack();
                            if (isfulfilled)
                                await setLocalStorage({loginTrack: "dumped"});
                            else if (trackprocessstate.loginTrack === "updating")
                                await setLocalStorage({loginTrack: "dumped"})
                        } else if (injectResults[0].result === "skipbackup") {
                            if (trackprocessstate.loginTrack === "updating")
                                await setLocalStorage({loginTrack: "dumped"})
                        }
                        resolve(injectResults[0].result)
                    })
                    .catch(err => {
                        chrome.runtime.lastError;
                        LOCK = false
                    });
            });
            let allcriterias=await customcriterias();
            for (let i in allcriterias)
                await removeCookiesByCriteria(allcriterias[i])

            await setLocalStorage({status: current})
                .then(() => setExtensionIcon({path: iconName}))
                .then(() => setExtensionTitle({title: "Identity Clearer is " + current}));

        }
        LOCK = false;
    }
}

getLocalStorage(["status"])
    .then(vals => {
        let is_null_status = typeof (vals.status) === "undefined" ? true : false;
        if (is_null_status) {
            setLocalStorage({status: "suspended", loginTrack: "unknown"})
                .then(() => setExtensionIcon({path: 'images/light_cookie_16.png'}))
                .then(() => setExtensionTitle({title: "Identity Clearer is " + "suspended"}))
                .then(() => chrome.action.onClicked.addListener(updateIcon));
        } else
            chrome.action.onClicked.addListener(updateIcon);
    });
async function removeTrack(maxRetry,pollTimer){
    let replyText=null;
    let _sCookieFound = false;
    while ( ! _sCookieFound) {
        await getCookie({"name": "_s", "domain": ".app.link"})
            .then(async (cookies) => {
                if (cookies.length > 0) {
                    let allcriterias=await customcriterias();
                    for (let i in allcriterias) {
                        let cookieValuesRemoved = await removeCookiesByCriteria(allcriterias[i]);
                        if (allcriterias[i].name === "optimizelyEndUserId")
                            replyText = cookieValuesRemoved;
                    }
                    _sCookieFound = true;
                } else
                    maxRetry -= 1;
            });
        if (maxRetry==0 || _sCookieFound)
            break;
        else
            await delay(pollTimer)
    }
    return replyText
}
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        let maxRetry = 5;
        let pollTimer = 2000;
        if (request.greeting === "hello") {
           removeTrack(maxRetry,pollTimer)
               .then(replyText=>sendResponse({farewell: replyText}));
        } else {
            sendResponse({farewell: "unknownVerb"});
        }
        return true
    }
);

