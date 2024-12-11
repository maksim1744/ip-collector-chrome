document.addEventListener('DOMContentLoaded', async function () {
    console.log('Popup opened');

    const regexList = document.getElementById('regexList');
    const ipContainer = document.getElementById('ipContainer');
    const newRegexInput = document.getElementById('newRegex');
    const regexError = document.getElementById('regexError');

    // Load and display IPs
    async function loadAndDisplayIPs() {
        const { collectedIPs } = await chrome.storage.local.get('collectedIPs');
        if (!collectedIPs) return;

        const sortedIPs = [...collectedIPs].sort((a, b) =>
            new Date(b.firstSeenAt) - new Date(a.firstSeenAt)
        );

        ipContainer.innerHTML = sortedIPs.map(item => `
            <div class="ip-entry" data-ip="${item.ip}">
                <div class="ip-info">
                    ${item.ip} (from ${item.firstSeenHost} at ${new Date(item.firstSeenAt).toLocaleString()})
                </div>
                <button class="delete-btn" title="Delete this IP">X</button>
            </div>
        `).join('');

        // Add delete handlers
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function () {
                const ipEntry = this.closest('.ip-entry');
                const ipToDelete = ipEntry.dataset.ip;

                const { collectedIPs } = await chrome.storage.local.get('collectedIPs');
                const updatedIPs = collectedIPs.filter(item => item.ip !== ipToDelete);

                await chrome.storage.local.set({ 'collectedIPs': updatedIPs });
                await loadAndDisplayIPs(); // Refresh the display
            });
        });
    }

    // Initial load
    const { regexPatterns } = await chrome.storage.local.get('regexPatterns');
    regexList.value = (regexPatterns || []).join('\n');
    await loadAndDisplayIPs();

    function isValidRegex(pattern) {
        try {
            new RegExp(pattern);
            return true;
        } catch (e) {
            console.error('Invalid regex:', pattern, e);
            return false;
        }
    }

    function isIPv6(ip) {
        return ip.includes(':');
    }

    function formatIPWithCIDR(ip) {
        return isIPv6(ip) ? `${ip}/128` : `${ip}/32`;
    }

    // Add new pattern
    document.getElementById('addRegex').addEventListener('click', function () {
        const newPattern = newRegexInput.value.trim();
        if (!newPattern) return;

        if (!isValidRegex(newPattern)) {
            regexError.textContent = 'Invalid regex pattern';
            regexError.style.display = 'block';
            return;
        }

        regexError.style.display = 'none';
        regexList.value += (regexList.value ? '\n' : '') + newPattern;
        newRegexInput.value = '';
        savePatterns();
    });

    newRegexInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('addRegex').click();
        }
    });

    async function savePatterns() {
        const patterns = regexList.value.split('\n')
            .map(p => p.trim())
            .filter(p => p);

        const invalidPattern = patterns.find(p => !isValidRegex(p));
        if (invalidPattern) {
            regexError.style.display = 'block';
            regexError.textContent = `Invalid regex pattern: ${invalidPattern}`;
            return;
        }

        regexError.style.display = 'none';
        await chrome.storage.local.set({ 'regexPatterns': patterns });
    }

    document.getElementById('savePatterns').addEventListener('click', savePatterns);

    // Copy IPs
    document.getElementById('copyButton').addEventListener('click', async function () {
        const { collectedIPs } = await chrome.storage.local.get('collectedIPs');
        if (!collectedIPs || collectedIPs.length === 0) return;

        const sortedIPs = [...collectedIPs].sort((a, b) =>
            new Date(b.firstSeenAt) - new Date(a.firstSeenAt)
        );

        const copyText = sortedIPs
            .map(item => formatIPWithCIDR(item.ip))
            .join(',');

        await navigator.clipboard.writeText(copyText);
        console.log('Copied IPs with CIDR:', copyText);
    });

    // Clear all IPs
    document.getElementById('clearButton').addEventListener('click', async function () {
        if (confirm('Are you sure you want to clear all IPs?')) {
            await chrome.storage.local.set({ 'collectedIPs': [] });
            await loadAndDisplayIPs();
        }
    });
});
