 function Main () {
    chrome.storage.local.get('status', data => {
        if (data.status=="running") {
            //pageFingerPrintLevel1 = '<meta data-rh="true" property="og:site_name" content="Medium">';
            //pageFingerPrintLevel2= '<meta data-rh="true" name="author" content="">';
            let timeUp = 5;
            let pageChecktimer = setInterval(checkForPageSignature, 1000);
            function checkForPageSignature() {
                if (document.querySelector(
                    "meta[data-rh='true'][property='og:site_name'][content='Medium']")
                    && document.querySelector(
                        "meta[data-rh='true'][name='author'][content]")
                ) {
                    clearInterval(pageChecktimer);
                    startJob()
                } else if (timeUp <= 1) {
                    clearInterval(pageChecktimer);
                    timeUp -= 1
                } else
                    timeUp -= 1
            }
        }
    } )
}
class TimeOutError extends Error {
    constructor(message) {
        super(message);
        this.name = "TimeOutError";
    }
}
function startJob() {
    //expectedKey="branch_session_first optimizely_data$$optimizelyEndUserId$$16180790160$$session_state" ;
    //expectedSessionKey="branch_session" ;
    let timeUp=8;
    let storageChecktimer = setInterval (checkForStorageReady, 1000);
    function checkForStorageReady () {
        let pollTimer=3000;
        let maxRetry=8;
        if ( sessionStorage.getItem("branch_session") ) {
            clearInterval(storageChecktimer);
            removeTrackRecord(pollTimer,maxRetry)
        }
        else if (timeUp<=1) {
            clearInterval(storageChecktimer);
            timeUp-=1
        }
        else
            timeUp-=1
    }
    function removeTrackRecord(pollTimer,maxRetry) {
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        function promptAndReply(message) {
            return new Promise(function(resolve,reject){
                chrome.runtime.sendMessage({greeting: message}, function (response) {
                    resolve(response.farewell) ;
                });
            })
        }
        async function checkAndClearTrack(pollTimer,maxRetry) {
            let uidField=null;
            while (uidField===null) {
               uidField=await promptAndReply("hello");
               if (uidField != null  && uidField!="unknownVerb") {
                    for (let i in uidField) {
                        //console.log("optimizely_data$$" + uidField[i] + "$$16180790160$$session_state");
                        localStorage.removeItem("optimizely_data$$" + uidField[i] + "$$16180790160$$session_state");
                    }
                    localStorage.removeItem("branch_session_first");
                    sessionStorage.removeItem("branch_session");
                    return 0
                }
                else if (maxRetry >1) {
                    await delay(pollTimer);
                    maxRetry-=1
                }
                else
                    throw new TimeOutError("Routine on " +document.URL+ " timed out")
            }
        }
        //console.log("checkAndClearTrack fired");
        checkAndClearTrack(pollTimer,maxRetry).then(function(returnCode){},function(err) {console.log(err.message)})
    }
}
Main();
