console.log('Service worker script loaded');

let ipMap;

async function initializeIPMap() {
    const { collectedIPs } = await chrome.storage.local.get('collectedIPs');
    ipMap = new Map(collectedIPs ? collectedIPs.map(item => [item.ip, item]) : []);
    console.log('Initialized ipMap from storage with', ipMap.size, 'IPs');
    return ipMap;
}

async function processRequest(details) {
    if (!ipMap) {
        console.log('ipMap not initialized, reinitializing...');
        await initializeIPMap();
    }

    if (!details.ip) {
        console.log('No IP in request details');
        return;
    }

    const { regexPatterns } = await chrome.storage.local.get('regexPatterns');
    const patterns = regexPatterns || [];

    try {
        const url = new URL(details.url);
        const hostname = url.hostname;
        console.log('Testing hostname:', hostname);

        for (const pattern of patterns) {
            try {
                const regex = new RegExp(pattern);
                if (regex.test(hostname)) {
                    console.log('Match found! Processing IP:', details.ip);

                    if (!ipMap.has(details.ip)) {
                        const ipData = {
                            ip: details.ip,
                            firstSeenHost: hostname,
                            firstSeenAt: new Date().toISOString(),
                        };
                        ipMap.set(details.ip, ipData);

                        await chrome.storage.local.set({
                            'collectedIPs': Array.from(ipMap.values())
                        });
                        console.log('IP map updated, new size:', ipMap.size);
                    } else {
                        console.log('IP already exists, skipping');
                    }
                    break;
                }
            } catch (e) {
                console.error('Invalid regex:', pattern, e);
            }
        }
    } catch (e) {
        console.error('Error processing URL:', e);
    }
}

(async () => {
    await initializeIPMap();

    // Listen to all completed requests (successful or not)
    chrome.webRequest.onCompleted.addListener(
        processRequest,
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
    );

    // Also listen to failed requests
    chrome.webRequest.onErrorOccurred.addListener(
        processRequest,
        { urls: ["<all_urls>"] }
    );
})();

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.collectedIPs) {
        console.log('Storage changed, updating ipMap');
        ipMap = new Map(changes.collectedIPs.newValue.map(item => [item.ip, item]));
        console.log('ipMap updated to size:', ipMap.size);
    }
});

// Add reinstall/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    await initializeIPMap();
});
