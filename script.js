const fileInput = document.getElementById('config-file');
const fileName = document.getElementById('file-name');
const injectBtn = document.getElementById('inject-btn');
const statusBox = document.getElementById('status-box');
const statusMsg = document.getElementById('status-msg');

window.onload = () => {
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (isFirefox && isAndroid) {
        const warningDiv = document.createElement('div');
        warningDiv.style = "background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; padding: 1rem; border-radius: 12px; text-align: center; color: #fca5a5; margin-top: 1.5rem; font-weight: 500; font-size: 0.95rem; line-height: 1.5;";
        warningDiv.innerHTML = "⚠️ <b>Firefox Android Terdeteksi!</b><br>Firefox terkenal sering 'Membisu / Nge-bug' saat dimintai file XML dari aplikasi File Pihak Ketiga. Jika Config kamu tidak mau ter-upload saat dipilih, mohon gunakan <b>Google Chrome</b>, <b>Brave</b>, atau <b>Microsoft Edge</b> untuk pengalaman paling optimal.";
        document.querySelector('header').appendChild(warningDiv);
    }
};

let configContent = null;
let originalFileNameStr = 'Injected_Config';

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Decode URL Encoded names from third-party Android File Managers (e.g. %20 instead of spaces)
    let decodedName = file.name;
    try {
        decodedName = decodeURIComponent(file.name);
    } catch (e) {
        // Fallback if not properly encoded
    }

    fileName.textContent = decodedName;
    const baseNameMatch = decodedName.match(/(.*?)\.xml$/i);
    originalFileNameStr = baseNameMatch ? baseNameMatch[1] : decodedName;

    // Otomatis terapkan prefix "F5" dan nama asli config ke kolom input
    // Menggunakan spasi / strip alih-alih ":" agar tidak error saat di-download di Windows
    document.getElementById('output-name').value = `F5 - ${originalFileNameStr}`;

    const reader = new FileReader();
    reader.onload = (e) => {
        configContent = e.target.result;
        injectBtn.disabled = false;
        injectBtn.classList.remove('disabled');
        statusMsg.innerHTML = "XML Ready! Click Inject to push Opmode 61456 into all streams.";
        statusBox.classList.remove('success');
    };
    
    // Handle Android security permission blocks from third-party File Managers
    reader.onerror = (e) => {
        statusMsg.innerHTML = `<b>⚠️ Warning:</b> OS File Manager failed to provide read access. (Error: ${e.target.error ? e.target.error.name : 'Unknown'}). The button is forced ON anyway to let you test.`;
        // Paksa aktifkan tombol bagaimanapun juga sesuai permintaan
        injectBtn.disabled = false;
        injectBtn.classList.remove('disabled');
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
            "pref_opmode_front_key", "pref_opmode_front_normal_key", // Nikita Front variations
            "pref_opmode_nigth_key" // CRITICAL Nikita Typo for Night Mode ("nigth" instead of "night")
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
            "pref_opmodes_key_4": "0", "pref_opmodes_key_front": "0",
            
            // Nikita Ultrawide Anti-Noise Fix:
            // Wipe the incompatible 64MP IMX686 noise-profile on Lens 3
            // Revert back to Auto/System handling just like LMC's extreme cleanliness Native algorithm
            "pref_noise_modeler_toggle_aux_key": "0", 
            "pref_noise_modeler_aux_key": "0",
            "pref_noise_model_key_3": "0",
            "lib_spatiala_key_3": "1", // Enable basic spatial denoise just in case
            "lib_spatialb_key_3": "1",
            "lib_lumanoise_key_3": "1",
            "lib_denoise_key_3": "1"
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

        // ----------------------------------------------------
        // EXCEPTION FOR LENS 3 (ULTRA_WIDE) - FORCE TO 33041 
        // ----------------------------------------------------
        // Xiaomi/Poco Wide lens usually crashes on 61456, we override all "_3" keys to 33041 instead
        const wideRegexContent = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_3))">)(.*?)(<\/\2>)/gi;
        finalXML = finalXML.replace(wideRegexContent, (match, p1, tag, pName, pVal, pClose) => {
            return p1 + '33041' + pClose;
        });
        const wideRegexAttr = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_3))"(?:\s+[^>]*)?value=")(.*?)(".*?\/>)/gi;
        finalXML = finalXML.replace(wideRegexAttr, (match, p1, tag, pName, pVal, pClose) => {
            return p1 + '33041' + pClose;
        });

        // Ensure Wide mode keys exist
        const wideRequiredKeys = [
            "pref_opmode_night_key_3", "pref_opmode_portrait_key_3", 
            "pref_opmode_video_key_3", "pref_opmode_normal_key_3", "pref_opmode_motion_key_3", "pref_opmode_key_3",
            "pref_opmode_experimental_key_3"
        ];
        wideRequiredKeys.forEach(reqKey => {
            if (!finalXML.includes(`name="${reqKey}"`)) {
                const fallbackTag = `    <string name="${reqKey}">33041</string>\n`;
                finalXML = finalXML.replace(/<\/map>/i, fallbackTag + "</map>");
                count++;
            }
        });

        // ----------------------------------------------------
        // FORCE AUX BUTTONS (MULTIPLE CAMERAS MAP & ENABLE)
        // ----------------------------------------------------
        const auxMapping = {
            // -- LMC Default Camera IDs --
            "pref_aux_get_id1_key": "0",
            "pref_aux_get_id2_key": "2",
            "pref_aux_get_id3_key": "3",
            "pref_aux_get_id4_key": "4",
            "pref_aux_get_id5_key": "5",
            "pref_aux_enable_id1_key": "1",
            "pref_aux_enable_id2_key": "1",
            "pref_aux_enable_id3_key": "0",  // From hyo.xml: user kept IDs 1 and 2 visible by default
            "pref_aux_enable_id4_key": "0",
            "pref_aux_enable_id5_key": "0",
            
            // -- Nikita "suportwidee.xml" Advanced Manual ID List --
            "pref_show_buttons_key": "1", // Show buttons on viewfinder
            "pref_switch_manual_camera_array_key": "1", // Use listed IDs
            "pref_enable_manual_array_key": "1", // Use given values (Rear Lens ID)
            "pref_manual_cameraid_key": "1",
            "pref_manual_array_key": "0,1,2,3,4,5,6", // List ID Manually
            "pref_aux_layout": "0", // Vertical layout
            
            // Nikita Rear Lens mapping (Main=0, Tele=2, Wide=2) => To match user UI screenshot
            "pref_manual_cameraid_back_1_key": "0",
            "pref_manual_cameraid_back_2_key": "2",
            "pref_manual_cameraid_back_3_key": "2",
            "pref_manual_cameraid_back_4_key": "4",
            "pref_manual_cameraid_back_5_key": "5",
            
            // Nikita Front Lens mapping (All set to 1) 
            "pref_manual_cameraid_front_1_key": "1",
            "pref_manual_cameraid_front_2_key": "1",
            "pref_manual_cameraid_front_3_key": "1",
            "pref_manual_cameraid_front_4_key": "1",
            "pref_manual_cameraid_front_5_key": "1",
            
            // Nikita UI Text Name Override (Optional visual fixes)
            "pref_manual_camera_name_key_main": "1x",
            "pref_manual_camera_name_key_2": "2x",
            "pref_manual_camera_name_key_3": "0.6x"
        };
        for (const [key, val] of Object.entries(auxMapping)) {
            const regexContent = new RegExp(`(<(?:string|int)\\s+name="${key}">)(.*?)(<\\/(?:string|int)>)`, "gi");
            if (regexContent.test(finalXML)) {
                finalXML = finalXML.replace(regexContent, `$1${val}$3`);
            } else if (new RegExp(`(<(?:string|int)\\s+name="${key}"(?:\\s+[^>]*)?value=")(.*?)(".*?\\/>)`, "gi").test(finalXML)) {
                finalXML = finalXML.replace(new RegExp(`(<(?:string|int)\\s+name="${key}"(?:\\s+[^>]*)?value=")(.*?)(".*?\\/>)`, "gi"), `$1${val}$3`);
            } else {
                const defaultTag = `    <string name="${key}">${val}</string>\n`;
                finalXML = finalXML.replace(/<\/map>/i, defaultTag + "</map>");
            }
        }

        let customName = document.getElementById('output-name').value.trim();
        if (!customName) customName = originalFileNameStr + '_Opmode61456';
        if (!customName.endsWith('.xml')) customName += '.xml';

        triggerDownload(finalXML, customName);
        
        statusMsg.innerHTML = `Success! ✨ Injected <b>61456 (Rear/Front)</b> + <b>33041 (Wide)</b> + <b>Multi-Cam AUX</b> ke ${count} parameter! File is downloading...`;
        statusBox.classList.add('success');

    } catch (err) {
        statusMsg.innerHTML = `<b>Error during injection:</b> ${err.message}`;
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
