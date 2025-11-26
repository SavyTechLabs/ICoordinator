/**
 * UI Manager
 * Handles sidebar interactions, metadata forms, and file inputs.
 */

class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.canvasManager = null; // Set later
        
        this.elements = {
            // Tools
            toolSelect: document.getElementById('tool-select'),
            toolDraw: document.getElementById('tool-draw'),
            toolPoly: document.getElementById('tool-poly'),
            
            // Zoom
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            zoomFit: document.getElementById('zoom-fit'),
            zoomLevel: document.getElementById('zoom-level'),
            
            // Metadata
            metadataContent: document.getElementById('metadata-content'),
            metadataEmpty: document.getElementById('metadata-empty'),
            metaId: document.getElementById('meta-id'),
            metaName: document.getElementById('meta-name'),
            metaDiscipline: document.getElementById('meta-discipline'),
            metaStatus: document.getElementById('meta-status'),
            metaColor: document.getElementById('meta-color'),
            metaComments: document.getElementById('meta-comments'),
            btnDeleteZone: document.getElementById('btn-delete-zone'),
            
            // Connected Activity
            connectedActivitySection: document.getElementById('connected-activity-section'),
            connectedActivitiesList: document.getElementById('connected-activities-list'),

            // Custom Fields
            customFieldsContainer: document.getElementById('custom-fields-container'),
            btnAddField: document.getElementById('btn-add-field'),

            // File Inputs
            layoutUpload: document.getElementById('layout-upload'),
            scheduleUpload: document.getElementById('schedule-upload'),
            jsonUpload: document.getElementById('json-upload'),
            btnExportJson: document.getElementById('btn-export-json'),
            
            // Layers / Schedule
            scheduleList: document.getElementById('schedule-list'),

            // Settings
            btnSettings: document.getElementById('btn-settings'),
            settingsModal: document.getElementById('settings-modal'),
            closeModalBtn: document.querySelector('.close-modal'),
            settingsDisciplinesList: document.getElementById('settings-disciplines-list'),
            settingsStatusesList: document.getElementById('settings-statuses-list'),
            btnAddDiscipline: document.getElementById('btn-add-discipline'),
            btnAddStatus: document.getElementById('btn-add-status'),

            // Mapping Modal
            mappingModal: document.getElementById('mapping-modal'),
            closeMappingModalBtn: document.getElementById('close-mapping-modal'),
            mapCode: document.getElementById('map-code'),
            mapTitle: document.getElementById('map-title'),
            mapStart: document.getElementById('map-start'),
            mapEnd: document.getElementById('map-end'),
            btnConfirmImport: document.getElementById('btn-confirm-import'),

            // Legend
            viewModeSelect: document.getElementById('view-mode-select'),
            legendItems: document.getElementById('legend-items'),

            // Activity Search
            activitySearch: document.getElementById('activity-search'),

            // Language
            settingsLanguage: document.getElementById('settings-language'),
            settingsZoneNaming: document.getElementById('settings-zone-naming')
        };

        this.tempExcelData = null; // Store raw data during mapping

        this.initEventListeners();
        
        // Subscribe to data changes to update legend and schedule list (if zones change, links might change)
        this.dataManager.subscribe((state) => {
            this.renderLegend();
            this.renderSchedule(); // Re-render schedule to update linked status
            
            // Check if language changed
            if (state.language !== this.currentLanguage) {
                this.currentLanguage = state.language;
                this.translateUI();
            }
        });
        
        // Initial render
        this.currentLanguage = this.dataManager.getState().language || 'sv';
        this.translateUI();
        this.renderLegend();
        this.renderSchedule(); // Restore schedule on load
    }

    setCanvasManager(cm) {
        this.canvasManager = cm;
    }

    // --- Localization ---

    t(key, params = {}) {
        const lang = this.currentLanguage;
        let text = TRANSLATIONS[lang][key] || key;
        
        // Replace params
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        
        return text;
    }

    translateUI() {
        const lang = this.currentLanguage;
        
        // Translate elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Translate elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // Translate elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update Language Selector
        if (this.elements.settingsLanguage) {
            this.elements.settingsLanguage.value = lang;
        }
        
        // Update Zone Naming Selector (not strictly translation, but good place to sync UI)
        if (this.elements.settingsZoneNaming) {
            this.elements.settingsZoneNaming.value = this.dataManager.getState().zoneNameMode || 'activity';
        }
    }

    initEventListeners() {
        // Tools
        this.elements.toolSelect.addEventListener('click', () => this.canvasManager.setTool('select'));
        this.elements.toolDraw.addEventListener('click', () => this.canvasManager.setTool('draw'));
        this.elements.toolPoly.addEventListener('click', () => this.canvasManager.setTool('poly'));

        // View Mode
        this.elements.viewModeSelect.addEventListener('change', (e) => {
            this.dataManager.setViewMode(e.target.value);
        });

        // Activity Search
        if (this.elements.activitySearch) {
            this.elements.activitySearch.addEventListener('input', () => this.renderSchedule());
        }

        // Zoom
        this.elements.zoomIn.addEventListener('click', () => {
            const rect = this.canvasManager.canvas.getBoundingClientRect();
            this.canvasManager.handleWheel({ 
                deltaY: -1, 
                clientX: rect.left + rect.width/2, 
                clientY: rect.top + rect.height/2, 
                preventDefault: () => {} 
            });
        });
        this.elements.zoomOut.addEventListener('click', () => {
            const rect = this.canvasManager.canvas.getBoundingClientRect();
            this.canvasManager.handleWheel({ 
                deltaY: 1, 
                clientX: rect.left + rect.width/2, 
                clientY: rect.top + rect.height/2, 
                preventDefault: () => {} 
            });
        });
        this.elements.zoomFit.addEventListener('click', () => this.canvasManager.zoomToFit());

        // Metadata Inputs (Auto-save)
        const inputs = ['metaName', 'metaDiscipline', 'metaStatus', 'metaColor', 'metaComments'];
        inputs.forEach(id => {
            this.elements[id].addEventListener('input', (e) => {
                this.updateSelectedZone(id, e.target.value);
            });
        });

        this.elements.btnDeleteZone.addEventListener('click', () => {
            if (confirm(this.t('confirmDeleteZone'))) {
                const zoneId = this.elements.metaId.value;
                this.dataManager.deleteZone(zoneId);
                this.selectZone(null);
                this.canvasManager.draw();
            }
        });

        // File Uploads
        this.elements.layoutUpload.addEventListener('change', (e) => this.handleLayoutUpload(e));
        this.elements.scheduleUpload.addEventListener('change', (e) => this.handleScheduleUpload(e));
        this.elements.jsonUpload.addEventListener('change', (e) => this.handleJsonUpload(e));
        this.elements.btnExportJson.addEventListener('click', () => this.dataManager.exportProject());
        this.elements.btnAddField.addEventListener('click', () => this.addCustomField());

        // Settings
        if (this.elements.btnSettings) {
            this.elements.btnSettings.addEventListener('click', () => this.openSettings());
        }
        if (this.elements.closeModalBtn) {
            this.elements.closeModalBtn.addEventListener('click', () => this.closeSettings());
        }
        if (this.elements.btnAddDiscipline) {
            this.elements.btnAddDiscipline.addEventListener('click', () => this.addDiscipline());
        }
        if (this.elements.btnAddStatus) {
            this.elements.btnAddStatus.addEventListener('click', () => this.addStatus());
        }
        
        if (this.elements.settingsLanguage) {
            this.elements.settingsLanguage.addEventListener('change', (e) => {
                this.dataManager.setLanguage(e.target.value);
            });
        }

        if (this.elements.settingsZoneNaming) {
            this.elements.settingsZoneNaming.addEventListener('change', (e) => {
                this.dataManager.setZoneNameMode(e.target.value);
            });
        }

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (this.elements.settingsModal && e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });

        // Mapping Modal
        if (this.elements.closeMappingModalBtn) {
            this.elements.closeMappingModalBtn.addEventListener('click', () => {
                if (this.elements.mappingModal) this.elements.mappingModal.classList.add('hidden');
                if (this.elements.scheduleUpload) this.elements.scheduleUpload.value = ''; // Reset input
            });
        }
        if (this.elements.btnConfirmImport) {
            this.elements.btnConfirmImport.addEventListener('click', () => this.confirmImport());
        }

        // Sidebar Tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                // Add active class to clicked
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }

    // --- UI Updates ---

    updateToolState(tool) {
        this.elements.toolSelect.classList.toggle('active', tool === 'select');
        this.elements.toolDraw.classList.toggle('active', tool === 'draw');
        this.elements.toolPoly.classList.toggle('active', tool === 'poly');
    }

    updateZoomLevel(percentage) {
        this.elements.zoomLevel.textContent = `${percentage}%`;
    }

    selectZone(zoneId) {
        if (!zoneId) {
            this.elements.metadataContent.classList.add('hidden');
            this.elements.metadataEmpty.classList.remove('hidden');
            return;
        }

        const zone = this.dataManager.getZone(zoneId);
        if (zone) {
            this.elements.metadataContent.classList.remove('hidden');
            this.elements.metadataEmpty.classList.add('hidden');

            // Populate Dropdowns dynamically
            const disciplines = this.dataManager.getState().disciplines;
            this.elements.metaDiscipline.innerHTML = `<option value="">${this.t('selectDiscipline')}</option>`;
            disciplines.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = this.t(d.name);
                this.elements.metaDiscipline.appendChild(option);
            });

            const statuses = this.dataManager.getState().statuses;
            this.elements.metaStatus.innerHTML = '';
            statuses.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = this.t(s.name);
                this.elements.metaStatus.appendChild(option);
            });

            // Populate fields
            this.elements.metaId.value = zone.id;
            this.elements.metaName.value = zone.name || '';
            this.elements.metaDiscipline.value = zone.discipline || '';
            this.elements.metaStatus.value = zone.status || 'planned';
            this.elements.metaColor.value = zone.color || '#2563EB';
            this.elements.metaComments.value = zone.comments || '';
            
            // Connected Activity Display
            let connectedActivities = zone.customData._connectedActivities || [];
            
            // Migration for display (if not yet migrated in data)
            if (zone.customData._activityCode && connectedActivities.length === 0) {
                 connectedActivities = [{
                    code: zone.customData._activityCode,
                    start: zone.customData._startDate,
                    end: zone.customData._endDate,
                    title: zone.customData.name || 'Legacy Activity'
                }];
            }

            this.elements.connectedActivitiesList.innerHTML = '';
            
            if (connectedActivities.length > 0) {
                this.elements.connectedActivitySection.classList.remove('hidden');
                
                connectedActivities.forEach((activity, index) => {
                    const card = document.createElement('div');
                    card.className = 'activity-card';
                    card.style.marginBottom = '10px';
                    
                    card.innerHTML = `
                        <div class="activity-row">
                            <span class="label" style="font-weight:bold;">${activity.title || this.t('namelessActivity')}</span>
                        </div>
                        <div class="activity-row">
                            <span class="label">${this.t('code')}:</span>
                            <span class="value">${activity.code}</span>
                        </div>
                        <div class="activity-row">
                            <span class="label">${this.t('date')}:</span>
                            <span class="value">${activity.start || '?'} -> ${activity.end || '?'}</span>
                        </div>
                    `;
                    
                    const disconnectBtn = document.createElement('button');
                    disconnectBtn.className = 'btn btn-small btn-outline full-width';
                    disconnectBtn.style.marginTop = '0.5rem';
                    disconnectBtn.textContent = this.t('disconnect');
                    disconnectBtn.onclick = () => this.disconnectActivity(index);
                    
                    card.appendChild(disconnectBtn);
                    this.elements.connectedActivitiesList.appendChild(card);
                });

            } else {
                this.elements.connectedActivitySection.classList.add('hidden');
            }

            this.renderCustomFields();
        }
    }

    updateSelectedZone(fieldId, value) {
        const zoneId = this.elements.metaId.value;
        if (!zoneId) return;

        const zone = this.dataManager.getZone(zoneId);
        if (!zone) return;

        const updates = {};
        switch (fieldId) {
            case 'metaName': updates.name = value; break;
            case 'metaDiscipline': 
                updates.discipline = value; 
                // Auto-set color from discipline if available
                const discipline = this.dataManager.getState().disciplines.find(d => d.id === value);
                if (discipline) {
                    updates.color = discipline.color;
                    this.elements.metaColor.value = discipline.color;
                }
                break;
            case 'metaStatus': updates.status = value; break;
            case 'metaColor': updates.color = value; break;
            case 'metaComments': updates.comments = value; break;
        }

        this.dataManager.updateZone({ ...zone, ...updates });
    }

    // --- File Handling ---

    async handleLayoutUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            this.renderPdf(file);
        } else if (file.type.startsWith('image/')) {
            this.renderImage(file);
        }
    }

    renderImage(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.canvasManager.setBackground(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    async renderPdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1); // Render first page
        
        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        this.canvasManager.setBackground(canvas);
    }

    async handleScheduleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await this.dataManager.parseExcelFile(file);
            if (data.length === 0) {
                alert(this.t('alertImportFail')); // Using generic fail message for empty file for now
                return;
            }
            
            this.tempExcelData = data;
            this.showMappingModal(data[0]);
        } catch (err) {
            console.error(err);
            alert(this.t('alertImportFail'));
        }
    }

    showMappingModal(firstRow) {
        const columns = Object.keys(firstRow);
        const selects = [this.elements.mapCode, this.elements.mapTitle, this.elements.mapStart, this.elements.mapEnd];
        
        // Helper to populate select
        const populate = (select, defaultKeywords) => {
            select.innerHTML = '<option value="">-- ' + this.t('select') + ' --</option>';
            columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                select.appendChild(option);
                
                // Auto-select if matches keyword
                if (defaultKeywords.some(k => col.toLowerCase().includes(k))) {
                    select.value = col;
                }
            });
        };

        populate(this.elements.mapCode, ['id', 'code', 'kod', 'activity id']);
        populate(this.elements.mapTitle, ['name', 'namn', 'activity', 'task', 'rubrik']);
        populate(this.elements.mapStart, ['start', 'början']);
        populate(this.elements.mapEnd, ['end', 'finish', 'slut', 'klar']);

        this.elements.mappingModal.classList.remove('hidden');
    }

    confirmImport() {
        const mapping = {
            code: this.elements.mapCode.value,
            title: this.elements.mapTitle.value,
            start: this.elements.mapStart.value,
            end: this.elements.mapEnd.value
        };

        if (!mapping.title) {
            alert(this.t('alertMappingTitle'));
            return;
        }

        // Process data
        const processedData = this.tempExcelData.map(row => ({
            code: row[mapping.code] || '',
            title: row[mapping.title] || this.t('namelessActivity'),
            start: this.formatDate(row[mapping.start]),
            end: this.formatDate(row[mapping.end]),
            originalData: row
        }));

        this.dataManager.setSchedule(processedData);
        this.renderSchedule();
        
        this.elements.mappingModal.classList.add('hidden');
        this.elements.scheduleUpload.value = '';
        this.tempExcelData = null;
        
        alert(this.t('alertImportSuccess').replace('{count}', processedData.length));
    }

    formatDate(excelDate) {
        if (!excelDate) return '';
        // Handle Excel serial dates if necessary, or string dates
        // For MVP assuming string or standard JS date parsable
        try {
            if (typeof excelDate === 'number') {
                // Excel serial date conversion could go here if needed
                // For now, just return as is or simple string
                return new Date(Math.round((excelDate - 25569)*86400*1000)).toISOString().split('T')[0];
            }
            const d = new Date(excelDate);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch (e) { }
        return String(excelDate);
    }

    async handleJsonUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await this.dataManager.importProject(file);
            this.canvasManager.draw();
            alert(this.t('alertProjectImported'));
        } catch (err) {
            console.error(err);
            alert(this.t('alertImportFail'));
        }
    }

    // --- Custom Fields ---

    addCustomField() {
        const fieldName = prompt(this.t('nameNewField'));
        if (fieldName) {
            const fieldId = 'custom_' + generateUUID();
            this.dataManager.addCustomField({ id: fieldId, name: fieldName, type: 'text' });
            this.renderCustomFields();
        }
    }

    renderCustomFields() {
        const container = this.elements.customFieldsContainer;
        container.innerHTML = '';
        
        const fields = this.dataManager.getState().customFields;
        const zoneId = this.elements.metaId.value;
        const zone = this.dataManager.getZone(zoneId);

        fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'form-group';
            
            const headerDiv = document.createElement('div');
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.marginBottom = '0.25rem';

            const label = document.createElement('label');
            label.textContent = field.name;
            label.style.marginBottom = '0';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.className = 'btn-text';
            deleteBtn.style.color = 'var(--danger-color)';
            deleteBtn.style.fontSize = '1.2rem';
            deleteBtn.style.lineHeight = '1';
            deleteBtn.title = this.t('confirmDelete');
            deleteBtn.onclick = () => {
                if(confirm(`${this.t('confirmDelete')} "${field.name}"?`)) {
                    this.dataManager.removeCustomField(field.id);
                    this.renderCustomFields();
                }
            };

            headerDiv.appendChild(label);
            headerDiv.appendChild(deleteBtn);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = zone && zone.customData && zone.customData[field.id] ? zone.customData[field.id] : '';
            
            input.addEventListener('input', (e) => {
                if (zone) {
                    const updatedCustomData = { ...zone.customData, [field.id]: e.target.value };
                    this.dataManager.updateZone({ ...zone, customData: updatedCustomData });
                }
            });

            div.appendChild(headerDiv);
            div.appendChild(input);
            container.appendChild(div);
        });
    }

    renderSchedule() {
        const list = this.elements.scheduleList;
        list.innerHTML = '';
        
        const schedule = this.dataManager.getState().schedule;
        const zones = this.dataManager.getState().zones;
        const searchTerm = this.elements.activitySearch ? this.elements.activitySearch.value.toLowerCase() : '';
        
        if (schedule.length === 0) {
            list.innerHTML = `<p class="text-muted small" style="padding: 0.5rem;">${this.t('noActivities')}</p>`;
            return;
        }

        // Create a set of linked activity codes for fast lookup
        const linkedCodes = new Set();
        zones.forEach(zone => {
            if (zone.customData) {
                if (zone.customData._activityCode) {
                    linkedCodes.add(String(zone.customData._activityCode));
                }
                if (zone.customData._connectedActivities) {
                    zone.customData._connectedActivities.forEach(a => linkedCodes.add(String(a.code)));
                }
            }
        });

        schedule.forEach((task, index) => {
            // Filter based on search term
            if (searchTerm) {
                const searchString = `${task.code} ${task.title} ${task.start} ${task.end}`.toLowerCase();
                if (!searchString.includes(searchTerm)) return;
            }

            const isLinked = linkedCodes.has(String(task.code));

            const el = document.createElement('div');
            el.className = `schedule-item ${isLinked ? 'linked-activity' : ''}`;
            el.draggable = true;
            
            el.innerHTML = `
                <div class="task-header">
                    <span class="task-code">${task.code || ''}</span>
                    <span class="task-dates">${task.start || ''} -> ${task.end || ''}</span>
                </div>
                <span class="task-name" title="${task.title}">${task.title}</span>
            `;

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(task));
                e.dataTransfer.effectAllowed = 'copy';
            });

            list.appendChild(el);
        });
    }

    // --- Settings UI ---

    openSettings() {
        this.renderSettings();
        this.elements.settingsModal.classList.remove('hidden');
    }

    closeSettings() {
        this.elements.settingsModal.classList.add('hidden');
        // Refresh dropdowns in case changes were made
        const selectedZoneId = this.elements.metaId.value;
        if (selectedZoneId) {
            this.selectZone(selectedZoneId);
        }
    }

    renderSettings() {
        this.renderSettingsList(
            this.elements.settingsDisciplinesList, 
            this.dataManager.getState().disciplines,
            'discipline'
        );
        this.renderSettingsList(
            this.elements.settingsStatusesList, 
            this.dataManager.getState().statuses,
            'status'
        );
    }

    renderSettingsList(container, items, type) {
        container.innerHTML = '';
        if (!items || !Array.isArray(items)) return;
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'settings-item';
            
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = item.color;
            colorInput.onchange = (e) => {
                const newItem = { ...item, color: e.target.value };
                if (type === 'discipline') this.dataManager.updateDiscipline(newItem);
                else this.dataManager.updateStatus(newItem);
            };

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = this.t(item.name);
            nameInput.onchange = (e) => {
                const newItem = { ...item, name: e.target.value };
                if (type === 'discipline') this.dataManager.updateDiscipline(newItem);
                else this.dataManager.updateStatus(newItem);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-text';
            deleteBtn.innerHTML = '×';
            deleteBtn.style.color = 'var(--danger-color)';
            deleteBtn.style.fontSize = '1.5rem';
            deleteBtn.onclick = () => {
                if (confirm(`${this.t('confirmDelete')} "${this.t(item.name)}"?`)) {
                    if (type === 'discipline') this.dataManager.removeDiscipline(item.id);
                    else this.dataManager.removeStatus(item.id);
                    this.renderSettings();
                }
            };

            div.appendChild(colorInput);
            div.appendChild(nameInput);
            div.appendChild(deleteBtn);
            container.appendChild(div);
        });
    }

    addDiscipline() {
        const name = prompt(this.t('nameDiscipline'));
        if (name) {
            this.dataManager.addDiscipline({
                id: generateUUID(),
                name: name,
                color: '#000000'
            });
            this.renderSettings();
        }
    }

    addStatus() {
        const name = prompt(this.t('nameStatus'));
        if (name) {
            this.dataManager.addStatus({
                id: generateUUID(),
                name: name,
                color: '#000000'
            });
            this.renderSettings();
        }
    }

    disconnectActivity(index) {
        const zoneId = this.elements.metaId.value;
        const zone = this.dataManager.getZone(zoneId);
        if (zone) {
            const newCustomData = { ...zone.customData };
            
            let connectedActivities = [...(newCustomData._connectedActivities || [])];

            // Handle legacy migration if needed before delete
            if (newCustomData._activityCode && connectedActivities.length === 0) {
                 connectedActivities = [{
                    code: newCustomData._activityCode,
                    start: newCustomData._startDate,
                    end: newCustomData._endDate,
                    title: newCustomData.name || 'Legacy Activity'
                }];
                // Clear legacy
                delete newCustomData._activityCode;
                delete newCustomData._startDate;
                delete newCustomData._endDate;
            }

            if (index >= 0 && index < connectedActivities.length) {
                connectedActivities.splice(index, 1);
            }
            
            newCustomData._connectedActivities = connectedActivities;
            
            this.dataManager.updateZone({ ...zone, customData: newCustomData });
            this.selectZone(zoneId); // Refresh UI
        }
    }

    // --- Legend ---

    renderLegend() {
        const state = this.dataManager.getState();
        const mode = state.viewMode || 'discipline';
        
        // Update select value if changed externally (e.g. load)
        this.elements.viewModeSelect.value = mode;

        this.elements.legendItems.innerHTML = '';
        
        let items = [];
        if (mode === 'discipline') {
            items = state.disciplines || [];
        } else {
            items = state.statuses || [];
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = item.color;
            
            const label = document.createElement('span');
            label.textContent = this.t(item.name);
            
            div.appendChild(colorBox);
            div.appendChild(label);
            this.elements.legendItems.appendChild(div);
        });
    }
}
