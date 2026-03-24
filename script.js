const fileInput = document.getElementById('config-file');
const fileName = document.getElementById('file-name');
const injectBtn = document.getElementById('inject-btn');
const statusBox = document.getElementById('status-box');
const statusMsg = document.getElementById('status-msg');

let configContent = null;
let originalFileNameStr = 'Injected_Config';

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    const baseNameMatch = file.name.match(/(.*?)\.xml$/i);
    originalFileNameStr = baseNameMatch ? baseNameMatch[1] : file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        configContent = e.target.result;
        injectBtn.disabled = false;
        injectBtn.classList.remove('disabled');
        statusMsg.innerHTML = "XML Ready! Click Inject to push Opmode 61456 into all streams.";
        statusBox.classList.remove('success');
    };
    reader.readAsText(file);
}

fileInput.addEventListener('change', handleFileSelect);

injectBtn.addEventListener('click', () => {
    try {
        if (!configContent) return;
        
        // Counter for replaced opmodes
        let count = 0;

        // Replace value inside tags <string name="pref_opmode...">VALUE</string>
        // STRICT Regex to exclude "pref_opmodes" and "pref_stream_opmode" which breaks the SDK Stream Mode dropdown
        const strictOpmodeContentRegex = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_[0-9]+|_front)?)">)(.*?)(<\/\2>)/gi;
        let finalXML = configContent.replace(strictOpmodeContentRegex, (match, p1, tag, pName, pVal, pClose) => {
            if (pVal !== '61456') count++;
            return p1 + '61456' + pClose;
        });

        // Replace value attribute in self closing tags <int name="pref_opmode..." value="VALUE" />
        const strictOpmodeAttrRegex = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_[0-9]+|_front)?)"(?:\s+[^>]*)?value=")(.*?)(".*?\/>)/gi;
        finalXML = finalXML.replace(strictOpmodeAttrRegex, (match, p1, tag, pName, pVal, pClose) => {
            if (pVal !== '61456') count++;
            return p1 + '61456' + pClose;
        });

        // Force adding common stream opmode keys if missing (covers BOTH Rear and Front cameras, plus Nikita specific keys like CSHOT)
        const requiredKeys = [
            "pref_opmode_night_key", "pref_opmode_portrait_key", 
            "pref_opmode_video_key", "pref_opmode_normal_key", "pref_opmode_motion_key", "pref_opmode_key",
            "pref_opmode_experimental_key",
            "pref_opmode_night_key_front", "pref_opmode_portrait_key_front", 
            "pref_opmode_video_key_front", "pref_opmode_normal_key_front", "pref_opmode_motion_key_front", "pref_opmode_key_front",
            "pref_opmode_experimental_key_front",
            "pref_opmode_cshot_key", "pref_opmode_cshot_key_front", // Nikita night mode
            "pref_opmode_slowmo_key", "pref_opmode_slowmo_key_front", // Nikita slow mo alternative
            "pref_opmode_front_key" // Alternative older front syntax
        ];
        
        requiredKeys.forEach(reqKey => {
            // Check if it exists natively
            if (!finalXML.includes(`name="${reqKey}"`)) {
                // Determine whether to insert it as a string tag
                const fallbackTag = `    <string name="${reqKey}">61456</string>\n`;
                // Insert it right before </map>
                finalXML = finalXML.replace(/<\/map>/i, fallbackTag + "</map>");
                count++;
            }
        });

        // FORCE enable Stream Configuration Toggles (Switch "Aktif") for Nikita and other GCams
        const enableStreamToggles = [
            "pref_opmode_custom_key", 
            "pref_stream_config_key", 
            "pref_opmodes_enable_key",
            "pref_stream_opmodes_enable_key",
            "pref_enable_system_opmode_key"
        ];

        enableStreamToggles.forEach(toggleName => {
            // Replace if it exists as false
            if (finalXML.includes(`name="${toggleName}" value="false"`)) {
                finalXML = finalXML.replace(new RegExp(`name="${toggleName}"\\s+value="false"`, 'g'), `name="${toggleName}" value="true"`);
            } else if (!finalXML.includes(`name="${toggleName}"`)) {
                // Insert if totally missing
                const toggleTag = `    <boolean name="${toggleName}" value="true" />\n`;
                finalXML = finalXML.replace(/<\/map>/i, toggleTag + "</map>");
            }
        });

        // ----------------------------------------------------
        // FORCE NIKITA's STREAM DROPDOWN TO "SDK 27" AND ENABLE
        // This fixes the "." force close menu bug in GCam Nikita
        // ----------------------------------------------------
        const nikitaDropdowns = {
            "pref_stream_opmode_key": "2", "pref_stream_opmode_key_2": "2", "pref_stream_opmode_key_3": "2", 
            "pref_stream_opmode_key_4": "2", "pref_stream_opmode_key_5": "2", "pref_stream_opmode_key_front": "2",
            "pref_opmodes_in": "1",
            "pref_opmodes_key": "1", "pref_opmodes_key_2": "1", "pref_opmodes_key_3": "1",
            "pref_opmodes_key_4": "0", "pref_opmodes_key_front": "0"
        };
        
        for (const [key, val] of Object.entries(nikitaDropdowns)) {
            // Replace if exists inside content tags (<string name="x">y</string>)
            const regexContent = new RegExp(`(<(?:string|int)\\s+name="${key}">)(.*?)(<\\/(?:string|int)>)`, "gi");
            if (regexContent.test(finalXML)) {
                finalXML = finalXML.replace(regexContent, `$1${val}$3`);
            } 
            // Replace if exists inside attr tags (<int name="x" value="y" />)
            else if (new RegExp(`(<(?:string|int)\\s+name="${key}"(?:\\s+[^>]*)?value=")(.*?)(".*?\\/>)`, "gi").test(finalXML)) {
                finalXML = finalXML.replace(new RegExp(`(<(?:string|int)\\s+name="${key}"(?:\\s+[^>]*)?value=")(.*?)(".*?\\/>)`, "gi"), `$1${val}$3`);
            } 
            // Otherwise, inject it natively
            else {
                const defaultTag = `    <string name="${key}">${val}</string>\n`;
                finalXML = finalXML.replace(/<\/map>/i, defaultTag + "</map>");
            }
        }

        let customName = document.getElementById('output-name').value.trim();
        if (!customName) customName = originalFileNameStr + '_Opmode61456';
        if (!customName.endsWith('.xml')) customName += '.xml';

        triggerDownload(finalXML, customName);
        
        statusMsg.innerHTML = `Success! ✨ Injected <b>61456</b> into ${count} stream parameters! File is downloading...`;
        statusBox.classList.add('success');

    } catch (err) {
        statusMsg.textContent = `Error during injection: ${err.message}`;
        console.error(err);
    }
});

function triggerDownload(content, filename) {
    const blob = new Blob([content], { type: "text/xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if(file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    }
});
