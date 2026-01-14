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
            toolCloud: document.getElementById('tool-cloud'),
            
            // Drawing Tools
            toolArrow: document.getElementById('tool-arrow'),
            toolLine: document.getElementById('tool-line'),
            toolEllipse: document.getElementById('tool-ellipse'),
            toolText: document.getElementById('tool-text'),
            toolDrawPoly: document.getElementById('tool-draw-poly'),
            toolDrawRect: document.getElementById('tool-draw-rect'),

            // Measurement Tools
            toolMeasureLength: document.getElementById('tool-measure-length'),
            toolMeasureArea: document.getElementById('tool-measure-area'),
            toolCalibrate: document.getElementById('tool-calibrate'),

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
            metaBorderColor: document.getElementById('meta-border-color'),
            metaPattern: document.getElementById('meta-pattern'),
            metaLineType: document.getElementById('meta-line-type'),
            metaTextColor: document.getElementById('meta-text-color'),
            metaAutoTextColor: document.getElementById('meta-auto-text-color'),
            metaOpacity: document.getElementById('meta-opacity'),
            opacityVal: document.getElementById('opacity-val'),
            metaNoFill: document.getElementById('meta-no-fill'),
            metaHidden: document.getElementById('meta-hidden'),
            metaComments: document.getElementById('meta-comments'),
            
            // New Metadata Fields
            metaStartDate: document.getElementById('meta-start-date'),
            metaEndDate: document.getElementById('meta-end-date'),
            metaDateDisplay: document.getElementById('meta-date-display'),
            metaContact: document.getElementById('meta-contact'),
            metaFreetext: document.getElementById('meta-freetext'),
            
            metaFontSizeGroup: document.getElementById('meta-font-size-group'),
            metaFontSize: document.getElementById('meta-font-size'),

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
            btnExportPdf: document.getElementById('btn-export-pdf'),
            
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
            settingsZoneNaming: document.getElementById('settings-zone-naming'),
            settingsFontSize: document.getElementById('settings-font-size'),

            // Layout Tabs
            layoutTabs: document.getElementById('layout-tabs'),
            btnAddLayout: document.getElementById('btn-add-layout'),

            // Filters
            filterText: document.getElementById('filter-text'),
            filterDisciplinesList: document.getElementById('filter-disciplines-list'),
            filterStatusesList: document.getElementById('filter-statuses-list'),
            // filterDateStart: document.getElementById('filter-date-start'), // Removed
            // filterDateEnd: document.getElementById('filter-date-end'), // Removed
            filterShowHidden: document.getElementById('filter-show-hidden'),
            btnResetFilters: document.getElementById('btn-reset-filters'),
            // filterWeek: document.getElementById('filter-week'), // REMOVED

            // Week Filter (Canvas)
            btnWeekFilter: document.getElementById('btn-week-filter'),
            weekFilterDropdown: document.getElementById('week-filter-dropdown'),
            weekFilterContent: document.getElementById('week-filter-content'),
            btnApplyWeeks: document.getElementById('btn-apply-weeks'),
            btnSelectAllWeeks: document.getElementById('btn-select-all-weeks'),
            dateRangeText: document.getElementById('date-range-text'),
            
            // Export Modal
            exportPdfModal: document.getElementById('export-pdf-modal'),
            closeExportModalBtn: document.getElementById('close-export-modal'),
            exportFilename: document.getElementById('export-filename'),
            exportQuality: document.getElementById('export-quality'),
            btnConfirmExport: document.getElementById('btn-confirm-export'),
            btnCancelExport: document.getElementById('btn-cancel-export'),

            // Symbols
            symbolsGrid: document.getElementById('symbols-grid'),
            symbolUpload: document.getElementById('symbol-upload')
        };

        this.tempExcelData = null; // Store raw data during mapping

        // Subscribe to state changes
        this.dataManager.subscribe(this.handleStateChange.bind(this));

        this.initEventListeners();
        
        // Subscribe to data changes to update legend and schedule list (if zones change, links might change)
        this.dataManager.subscribe((state) => {
            this.renderLegend();
            this.renderSchedule(); // Re-render schedule to update linked status
            this.renderLayoutTabs(); // Re-render tabs
            
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
        this.renderLayoutTabs();
        this.renderFilters();

        // Init Version Info
        const versionEl = document.getElementById('settings-version-info');
        if (versionEl) {
            versionEl.textContent = this.dataManager.appVersion;
        }
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
            if (key === 'qualityInfo') {
                el.innerHTML = this.t(key);
            } else {
                el.textContent = this.t(key);
            }
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
        this.elements.toolCloud.addEventListener('click', () => this.canvasManager.setTool('cloud'));

        // Drawing Tools
        this.elements.toolArrow.addEventListener('click', () => this.canvasManager.setTool('arrow'));
        this.elements.toolLine.addEventListener('click', () => this.canvasManager.setTool('line'));
        this.elements.toolEllipse.addEventListener('click', () => this.canvasManager.setTool('ellipse'));
        this.elements.toolText.addEventListener('click', () => this.canvasManager.setTool('text'));
        this.elements.toolDrawPoly.addEventListener('click', () => this.canvasManager.setTool('draw-poly'));
        this.elements.toolDrawRect.addEventListener('click', () => this.canvasManager.setTool('draw-rect'));

        // Measurement Tools
        this.elements.toolMeasureLength.addEventListener('click', () => this.canvasManager.setTool('measure-length'));
        this.elements.toolMeasureArea.addEventListener('click', () => this.canvasManager.setTool('measure-area'));
        this.elements.toolCalibrate.addEventListener('click', () => this.canvasManager.setTool('calibrate'));

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
        const inputs = ['metaName', 'metaDiscipline', 'metaStatus', 'metaColor', 'metaBorderColor', 'metaPattern', 'metaLineType', 'metaComments', 'metaStartDate', 'metaEndDate', 'metaContact', 'metaFreetext', 'metaOpacity', 'metaNoFill', 'metaHidden', 'metaFontSize', 'metaTextColor', 'metaAutoTextColor'];
        inputs.forEach(id => {
            const el = this.elements[id];
            if (el) {
                const eventType = (el.type === 'checkbox' || el.type === 'range') ? 'change' : 'input';
                el.addEventListener(eventType, (e) => {
                    const val = el.type === 'checkbox' ? el.checked : el.value;
                    this.updateSelectedZone(id, val);
                });
                // For range slider, update label immediately on input
                if (el.type === 'range') {
                    el.addEventListener('input', (e) => {
                        this.elements.opacityVal.textContent = Math.round(e.target.value * 100) + '%';
                    });
                }
            }
        });

        this.elements.btnDeleteZone.addEventListener('click', () => {
            this.canvasManager.deleteSelectedZones();
        });

        // File Uploads
        this.elements.layoutUpload.addEventListener('change', (e) => this.handleLayoutUpload(e));
        this.elements.scheduleUpload.addEventListener('change', (e) => this.handleScheduleUpload(e));
        this.elements.jsonUpload.addEventListener('change', (e) => this.handleJsonUpload(e));
        this.elements.btnExportJson.addEventListener('click', () => {
            const defaultName = this.dataManager.getState().projectInfo.name || "icoordinator_project";
            this.dataManager.exportProject(defaultName);
        });
        if (this.elements.btnExportPdf) {
            this.elements.btnExportPdf.addEventListener('click', () => {
                this.openExportModal();
            });
        }
        
        // Export Modal Events
        if (this.elements.exportPdfModal) {
            if (this.elements.closeExportModalBtn) {
                this.elements.closeExportModalBtn.addEventListener('click', () => this.closeExportModal());
            }
            if (this.elements.btnCancelExport) {
                this.elements.btnCancelExport.addEventListener('click', () => this.closeExportModal());
            }
            if (this.elements.btnConfirmExport) {
                this.elements.btnConfirmExport.addEventListener('click', () => {
                    const filename = this.elements.exportFilename.value || 'icoordinator-export';
                    const quality = parseFloat(this.elements.exportQuality.value);
                    this.canvasManager.exportPdf(quality, filename);
                    this.closeExportModal();
                });
            }
            // Close on click outside
            this.elements.exportPdfModal.addEventListener('click', (e) => {
                if (e.target === this.elements.exportPdfModal) {
                    this.closeExportModal();
                }
            });
        }

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

        if (this.elements.settingsFontSize) {
            this.elements.settingsFontSize.addEventListener('change', (e) => {
                const newSize = parseInt(e.target.value) || 14;
                this.dataManager.updateProjectSettings({ baseFontSize: newSize });
                this.canvasManager.draw(); 
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

        // Layout Tabs
        if (this.elements.btnAddLayout) {
            this.elements.btnAddLayout.addEventListener('click', () => {
                const name = prompt(this.t('nameNewLayout'), `Layout ${this.dataManager.getState().layouts.length + 1}`);
                if (name) {
                    this.dataManager.addLayout(name);
                }
            });
        }

        // Filters
        if (this.elements.filterText) {
            this.elements.filterText.addEventListener('input', (e) => {
                this.dataManager.setFilters({ text: e.target.value });
            });
        }
        /* Removed Date Range Filters
        if (this.elements.filterDateStart) {
            this.elements.filterDateStart.addEventListener('change', (e) => {
                this.dataManager.setFilters({ dateStart: e.target.value });
            });
        }
        if (this.elements.filterDateEnd) {
            this.elements.filterDateEnd.addEventListener('change', (e) => {
                this.dataManager.setFilters({ dateEnd: e.target.value });
            });
        }
        */
        if (this.elements.filterShowHidden) {
            this.elements.filterShowHidden.addEventListener('change', (e) => {
                this.dataManager.setFilters({ showHidden: e.target.checked });
            });
        }

        if (this.elements.btnResetFilters) {
            this.elements.btnResetFilters.addEventListener('click', () => {
                this.dataManager.resetFilters();
                // Reset UI inputs manually as they don't auto-bind two-way perfectly here
                this.elements.filterText.value = '';
                // this.elements.filterDateStart.value = '';
                // this.elements.filterDateEnd.value = '';
                if (this.elements.filterShowHidden) this.elements.filterShowHidden.checked = false;
                this.renderFilters(); // Re-render checkboxes
            });
        }

        // Week Filter
        if (this.elements.btnWeekFilter) {
            this.elements.btnWeekFilter.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleWeekFilter();
            });
        }

        if (this.elements.btnSelectAllWeeks) {
            this.elements.btnSelectAllWeeks.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const checkboxes = this.elements.weekFilterContent.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
            });
        }

        if (this.elements.btnApplyWeeks) {
            this.elements.btnApplyWeeks.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const checkboxes = this.elements.weekFilterContent.querySelectorAll('input[type="checkbox"]:checked');
                const allCheckboxes = this.elements.weekFilterContent.querySelectorAll('input[type="checkbox"]');
                
                let selectedWeeks = [];
                // Only set filter if NOT all are selected (if all selected, empty filter = show all)
                if (checkboxes.length > 0 && checkboxes.length < allCheckboxes.length) {
                    selectedWeeks = Array.from(checkboxes).map(cb => parseInt(cb.value));
                }
                
                this.dataManager.setFilters({ weeks: selectedWeeks });
                this.toggleWeekFilter(false);
            });
        }

        // Close dropdown when clicking outside
        window.addEventListener('click', (e) => {
            if (this.elements.weekFilterDropdown && !this.elements.weekFilterDropdown.classList.contains('hidden')) {
               if (!this.elements.weekFilterDropdown.contains(e.target) && e.target !== this.elements.btnWeekFilter && !this.elements.btnWeekFilter.contains(e.target)) {
                   this.toggleWeekFilter(false);
               }
           }
       });

        // Symbol Upload
        if (this.elements.symbolUpload) {
            this.elements.symbolUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = event.target.result;
                    const isSvg = file.type === 'image/svg+xml';
                    
                    // If SVG, we might want to store the content string if possible, or dataURL
                    // For simplicity, let's use dataURL for everything for now, 
                    // unless we want to parse SVG to change colors later.
                    
                    // Actually, for SVG symbols to be colorable, we need the raw SVG string.
                    if (isSvg) {
                        // Read as text to get SVG string
                        const textReader = new FileReader();
                        textReader.onload = (te) => {
                            this.dataManager.addSymbol({
                                id: generateUUID(),
                                name: file.name.split('.')[0],
                                type: 'svg',
                                src: te.target.result
                            });
                        };
                        textReader.readAsText(file);
                    } else {
                        this.dataManager.addSymbol({
                            id: generateUUID(),
                            name: file.name.split('.')[0],
                            type: 'image',
                            src: result
                        });
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // --- UI Updates ---

    updateToolState(tool) {
        this.elements.toolSelect.classList.toggle('active', tool === 'select');
        this.elements.toolDraw.classList.toggle('active', tool === 'draw');
        this.elements.toolPoly.classList.toggle('active', tool === 'poly');
        this.elements.toolCloud.classList.toggle('active', tool === 'cloud');
        
        this.elements.toolArrow.classList.toggle('active', tool === 'arrow');
        this.elements.toolLine.classList.toggle('active', tool === 'line');
        this.elements.toolEllipse.classList.toggle('active', tool === 'ellipse');
        this.elements.toolText.classList.toggle('active', tool === 'text');
        this.elements.toolDrawPoly.classList.toggle('active', tool === 'draw-poly');
        this.elements.toolDrawRect.classList.toggle('active', tool === 'draw-rect');

        this.elements.toolMeasureLength.classList.toggle('active', tool === 'measure-length');
        this.elements.toolMeasureArea.classList.toggle('active', tool === 'measure-area');
        this.elements.toolCalibrate.classList.toggle('active', tool === 'calibrate');
    }

    updateZoomLevel(percentage) {
        this.elements.zoomLevel.textContent = `${percentage}%`;
    }

    selectZone(selection) {
        let zoneIds = [];
        if (selection instanceof Set) {
            zoneIds = Array.from(selection);
        } else if (Array.isArray(selection)) {
            zoneIds = selection;
        } else if (selection) {
            zoneIds = [selection];
        }

        if (zoneIds.length === 0) {
            this.elements.metadataContent.classList.add('hidden');
            this.elements.metadataEmpty.classList.remove('hidden');
            return;
        }

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

        if (zoneIds.length === 1) {
            const zoneId = zoneIds[0];
            const zone = this.dataManager.getZone(zoneId);
            if (!zone) return;

            // Populate fields
            this.elements.metaId.value = zone.id;
            this.elements.metaName.value = zone.name || '';
            this.elements.metaDiscipline.value = zone.discipline || '';
            this.elements.metaStatus.value = zone.status || 'planned';
            this.elements.metaColor.value = zone.color || '#2563EB';
            this.elements.metaBorderColor.value = zone.borderColor || zone.color || '#2563EB';
            this.elements.metaPattern.value = zone.pattern || 'none';
            this.elements.metaLineType.value = zone.lineType || 'solid';
            this.elements.metaComments.value = zone.comments || '';
            
            // New Fields
            this.elements.metaStartDate.value = zone.startDate || '';
            this.elements.metaEndDate.value = zone.endDate || '';
            
            // Calculate display string (Week-Day range)
            let dateDisplay = '';
            if (zone.startDate && zone.endDate) {
                const startStr = getWeekDayString(zone.startDate);
                const endStr = getWeekDayString(zone.endDate);
                dateDisplay = `${startStr} - ${endStr}`;
            } else if (zone.startDate) {
                dateDisplay = getWeekDayString(zone.startDate);
            } else if (zone.date) {
                // Fallback for legacy single date
                this.elements.metaStartDate.value = zone.date;
                dateDisplay = getWeekDayString(zone.date);
            }
            this.elements.metaDateDisplay.value = dateDisplay;

            this.elements.metaContact.value = zone.contact || '';
            this.elements.metaFreetext.value = zone.freetext || '';
            
            // Visuals
            this.elements.metaOpacity.value = zone.opacity !== undefined ? zone.opacity : 0.5;
            this.elements.opacityVal.textContent = Math.round((zone.opacity !== undefined ? zone.opacity : 0.5) * 100) + '%';
            this.elements.metaNoFill.checked = !!zone.noFill;
            this.elements.metaHidden.checked = !!zone.hidden;

            // Text Color
            const textColor = zone.textColor || '#000000';
            const autoTextColor = zone.autoTextColor !== undefined ? zone.autoTextColor : true;
            this.elements.metaTextColor.value = textColor;
            this.elements.metaAutoTextColor.checked = autoTextColor;
            this.elements.metaTextColor.disabled = autoTextColor;

            // Handle Symbol/Cloud vs Zone UI
            const isSymbol = zone.type === 'symbol' || zone.type === 'cloud';
            const isText = zone.type === 'text';
            const isMeasurement = zone.type === 'measure-length' || zone.type === 'measure-area' || zone.type === 'arrow' || zone.type === 'line' || zone.type === 'draw-poly' || zone.type === 'draw-rect';
            
            // Font Size
            if (isText) {
                this.elements.metaFontSizeGroup.classList.remove('hidden');
                this.elements.metaFontSize.value = (zone.customData && zone.customData.fontSize) || 16;
            } else {
                this.elements.metaFontSizeGroup.classList.add('hidden');
            }

            // Fields to hide for symbols/text/measurements
            const zoneOnlyFields = [
                this.elements.metaStartDate.parentElement.parentElement, // Parent of the flex container
                this.elements.metaContact.parentElement,
                this.elements.connectedActivitySection,
                this.elements.metaDiscipline.parentElement,
                this.elements.metaStatus.parentElement
            ];

            zoneOnlyFields.forEach(el => {
                if (el) el.style.display = (isSymbol || isText || isMeasurement) ? 'none' : 'block';
            });

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
        } else {
            // Multi Selection
            this.elements.metaId.value = 'multi';
            this.elements.metaName.value = `${zoneIds.length} ${this.t('itemsSelected')}`;
            
            // Helper to check if all values are same
            const getCommonValue = (key, defaultVal = '') => {
                const first = this.dataManager.getZone(zoneIds[0])[key];
                return zoneIds.every(id => this.dataManager.getZone(id)[key] === first) ? first : defaultVal;
            };

            const commonDiscipline = getCommonValue('discipline', null);
            this.elements.metaDiscipline.value = commonDiscipline || '';

            const commonStatus = getCommonValue('status', null);
            this.elements.metaStatus.value = commonStatus || '';

            this.elements.metaColor.value = getCommonValue('color', '#000000');
            this.elements.metaBorderColor.value = getCommonValue('borderColor', '#000000');
            this.elements.metaPattern.value = getCommonValue('pattern', 'none');
            this.elements.metaComments.value = ''; 

            // Hide specific fields
            this.elements.metaStartDate.parentElement.parentElement.style.display = 'none';
            this.elements.metaContact.parentElement.style.display = 'none';
            this.elements.connectedActivitySection.classList.add('hidden');
            
            // Visuals
            const commonOpacity = getCommonValue('opacity', 0.5);
            this.elements.metaOpacity.value = commonOpacity;
            this.elements.opacityVal.textContent = Math.round(commonOpacity * 100) + '%';
            
            this.elements.metaNoFill.checked = getCommonValue('noFill', false);
            this.elements.metaHidden.checked = getCommonValue('hidden', false);
            
            // Text Color Multi
            this.elements.metaTextColor.value = getCommonValue('textColor', '#000000');
            const commonAuto = getCommonValue('autoTextColor', true);
            this.elements.metaAutoTextColor.checked = commonAuto;
            this.elements.metaTextColor.disabled = commonAuto;

            // Clear custom fields for now
            this.elements.customFieldsContainer.innerHTML = '';
        }
    }

    updateSelectedZone(fieldId, value) {
        const selection = this.canvasManager.selectedZoneIds;
        if (!selection || selection.size === 0) return;

        const zoneIds = Array.from(selection);

        zoneIds.forEach(zoneId => {
            const zone = this.dataManager.getZone(zoneId);
            if (!zone) return;

            const updates = {};
            switch (fieldId) {
                case 'metaName': 
                    if (zoneIds.length === 1) updates.name = value; 
                    break;
                case 'metaDiscipline': 
                    updates.discipline = value; 
                    // Auto-set color from discipline if available
                    const discipline = this.dataManager.getState().disciplines.find(d => d.id === value);
                    if (discipline) {
                        updates.color = discipline.color;
                        if (zoneIds.length === 1) this.elements.metaColor.value = discipline.color;
                    }
                    break;
                case 'metaStatus': updates.status = value; break;
                case 'metaColor': updates.color = value; break;
                case 'metaBorderColor': updates.borderColor = value; break;
                case 'metaPattern': updates.pattern = value; break;
                case 'metaComments': 
                    if (zoneIds.length === 1) updates.comments = value; 
                    break;
                
                // New Fields
                case 'metaStartDate': 
                    if (zoneIds.length === 1) {
                        updates.startDate = value;
                        // Update display
                        const end = zone.endDate || '';
                        const startStr = getWeekDayString(value);
                        const endStr = end ? getWeekDayString(end) : '';
                        this.elements.metaDateDisplay.value = end ? `${startStr} - ${endStr}` : startStr;
                    }
                    break;
                case 'metaEndDate': 
                    if (zoneIds.length === 1) {
                        updates.endDate = value;
                        // Update display
                        const start = zone.startDate || '';
                        const startStr = start ? getWeekDayString(start) : '';
                        const endStr = getWeekDayString(value);
                        this.elements.metaDateDisplay.value = start ? `${startStr} - ${endStr}` : endStr;
                    }
                    break;
                case 'metaContact': 
                    if (zoneIds.length === 1) updates.contact = value; 
                    break;
                case 'metaFreetext': 
                    if (zoneIds.length === 1) updates.freetext = value; 
                    break;
                case 'metaTextColor':
                    updates.textColor = value;
                    break;
                case 'metaAutoTextColor':
                    updates.autoTextColor = value;
                    this.elements.metaTextColor.disabled = value;
                    break;
                case 'metaFontSize':
                    const newSize = parseInt(value);
                    updates.customData = { ...zone.customData, fontSize: newSize };
                    
                    // Auto-resize box to fit new font size
                    if (this.canvasManager && this.canvasManager.ctx) {
                        this.canvasManager.ctx.save();
                        this.canvasManager.ctx.font = `${newSize}px Arial`;
                        const metrics = this.canvasManager.ctx.measureText(zone.name);
                        updates.width = metrics.width;
                        updates.height = newSize * 1.2;
                        this.canvasManager.ctx.restore();
                    }
                    break;
                case 'metaOpacity': updates.opacity = parseFloat(value); break;
                case 'metaNoFill': updates.noFill = value; break;
                case 'metaHidden': updates.hidden = value; break;
            }

            if (Object.keys(updates).length > 0) {
                this.dataManager.updateZone({ ...zone, ...updates });
            }
        });
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
        
        // Reduce scale to avoid huge Data URLs that crash localStorage
        const viewport = page.getViewport({ scale: 1.5 }); 
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

        // Check if XLSX is available
        if (typeof XLSX === 'undefined') {
            alert(this.t('alertSheetJS'));
            return;
        }

        try {
            const data = await this.dataManager.parseExcelFile(file);
            if (!data || data.length === 0) {
                alert(this.t('alertImportFail') + " (Filen verkar tom)");
                return;
            }
            
            this.tempExcelData = data;
            this.showMappingModal(data[0]);
        } catch (err) {
            console.error(err);
            alert(this.t('alertImportFail') + "\n" + err.message);
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
        console.log("Confirm import clicked");
        
        if (!this.tempExcelData) {
            console.error("No Excel data to import");
            alert(this.t('alertNoData'));
            this.elements.mappingModal.classList.add('hidden');
            return;
        }

        const mapping = {
            code: this.elements.mapCode.value,
            title: this.elements.mapTitle.value,
            start: this.elements.mapStart.value,
            end: this.elements.mapEnd.value
        };

        console.log("Mapping:", mapping);

        if (!mapping.title) {
            alert(this.t('alertMappingTitle'));
            return;
        }

        try {
            // Process data
            const processedData = this.tempExcelData.map(row => ({
                code: row[mapping.code] || '',
                title: row[mapping.title] || this.t('namelessActivity'),
                start: this.formatDate(row[mapping.start]),
                end: this.formatDate(row[mapping.end]),
                originalData: row
            }));

            console.log("Processed data:", processedData);

            this.dataManager.setSchedule(processedData);
            this.renderSchedule();
            
            this.elements.mappingModal.classList.add('hidden');
            this.elements.scheduleUpload.value = '';
            this.tempExcelData = null;
            
            alert(this.t('alertImportSuccess').replace('{count}', processedData.length));
        } catch (e) {
            console.error("Import error:", e);
            alert(this.t('alertImportError') + e.message);
        }
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
        const searchTerm = this.elements.activitySearch ? this.elements.activitySearch.value.toLowerCase() : '';
        
        if (schedule.length === 0) {
            list.innerHTML = `<p class="text-muted small" style="padding: 0.5rem;">${this.t('noActivities')}</p>`;
            return;
        }

        // Create a set of linked activity codes for fast lookup
        const linkedCodes = new Set();
        const layouts = this.dataManager.getState().layouts || [];
        
        layouts.forEach(layout => {
            if (layout.zones) {
                layout.zones.forEach(zone => {
                    if (zone.customData) {
                        if (zone.customData._activityCode) {
                            linkedCodes.add(String(zone.customData._activityCode));
                        }
                        if (zone.customData._connectedActivities) {
                            zone.customData._connectedActivities.forEach(a => linkedCodes.add(String(a.code)));
                        }
                    }
                });
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
        // Set current font size
        if (this.elements.settingsFontSize) {
            const currentSize = this.dataManager.getState().projectSettings?.baseFontSize || 14;
            this.elements.settingsFontSize.value = currentSize;
        }

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

    openExportModal() {
        if (this.elements.exportPdfModal) {
            this.elements.exportPdfModal.classList.remove('hidden');
            // Set default filename based on project name if available
            const projectInfo = this.dataManager.getState().projectInfo;
            if (projectInfo && projectInfo.name) {
                // Sanitize filename
                const safeName = projectInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                this.elements.exportFilename.value = safeName || 'icoordinator-export';
            }
        }
    }

    closeExportModal() {
        if (this.elements.exportPdfModal) {
            this.elements.exportPdfModal.classList.add('hidden');
        }
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

    addLayoutTab() {
        const tabName = prompt(this.t('nameNewLayout'));
        if (tabName) {
            const tabId = 'layout_' + generateUUID();
            
            // Add to data manager
            this.dataManager.addLayoutTab({ id: tabId, name: tabName });
            
            // Refresh tabs
            this.renderLayoutTabs();
        }
    }

    renderLayoutTabs() {
        if (!this.elements.layoutTabs) return;
        
        const container = this.elements.layoutTabs;
        container.innerHTML = '';
        
        const state = this.dataManager.getState();
        const layouts = state.layouts || [];
        const activeId = state.activeLayoutId;

        layouts.forEach(layout => {
            const tab = document.createElement('div');
            tab.className = `layout-tab ${layout.id === activeId ? 'active' : ''}`;
            
            // Make the whole tab clickable for switching
            tab.onclick = () => {
                if (layout.id !== activeId) {
                    this.dataManager.setActiveLayout(layout.id);
                }
            };

            const nameSpan = document.createElement('span');
            nameSpan.textContent = layout.name;
            nameSpan.ondblclick = (e) => {
                e.stopPropagation();
                const newName = prompt(this.t('renameLayout'), layout.name);
                if (newName && newName !== layout.name) {
                    this.dataManager.renameLayout(layout.id, newName);
                }
            };
            
            tab.appendChild(nameSpan);

            // Close button (only if more than 1 layout)
            if (layouts.length > 1) {
                const closeBtn = document.createElement('span');
                closeBtn.className = 'close-tab';
                closeBtn.innerHTML = '&times;';
                closeBtn.title = this.t('deleteLayoutTitle');
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(this.t('confirmDeleteLayout', {name: layout.name}))) {
                        this.dataManager.deleteLayout(layout.id);
                    }
                };
                tab.appendChild(closeBtn);
            }

            container.appendChild(tab);
        });
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

            // Recalculate dates if activities remain
            let updates = { customData: newCustomData };
            
            if (connectedActivities.length > 0) {
                let minStart = null;
                let maxEnd = null;
                
                connectedActivities.forEach(a => {
                    if (a.start) {
                        if (!minStart || a.start < minStart) minStart = a.start;
                    }
                    if (a.end) {
                        if (!maxEnd || a.end > maxEnd) maxEnd = a.end;
                    }
                });
                updates.startDate = minStart;
                updates.endDate = maxEnd;
            }
            
            this.dataManager.updateZone({ ...zone, ...updates });
            this.selectZone(zoneId); // Refresh UI
        }
    }

    // --- Legend ---

    renderLegend() {
        const state = this.dataManager.getState();
        const mode = state.viewMode || 'discipline';
        const activeLayout = this.dataManager.getActiveLayout();
        const zones = activeLayout ? activeLayout.zones : [];
        
        // Update select value if changed externally (e.g. load)
        this.elements.viewModeSelect.value = mode;

        this.elements.legendItems.innerHTML = '';
        
        let allItems = [];
        if (mode === 'discipline') {
            allItems = state.disciplines || [];
        } else {
            allItems = state.statuses || [];
        }

        // Filter items to show only those present/visible in current canvas
        // We consider a property "visible" if at least one visible ("!hidden") zone uses it.
        const usedIds = new Set();
        zones.forEach(zone => {
           if (!zone.hidden) { // Only count visible zones
               const val = mode === 'discipline' ? zone.discipline : zone.status;
               if (val) usedIds.add(val);
           } 
        });

        const filteredItems = allItems.filter(item => usedIds.has(item.id));

        filteredItems.forEach(item => {
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

    toggleWeekFilter(show) {
        if (!this.elements.weekFilterDropdown) return;
        
        const isHidden = this.elements.weekFilterDropdown.classList.contains('hidden');
        const shouldShow = show !== undefined ? show : isHidden;
        
        if (shouldShow) {
            this.elements.weekFilterDropdown.classList.remove('hidden');
        } else {
            this.elements.weekFilterDropdown.classList.add('hidden');
        }
    }

    populateWeekFilter() {
        if (!this.elements.weekFilterContent) return;
        
        const state = this.dataManager.getState();
        const zones = [];
        state.layouts.forEach(l => {
            if (l.zones) zones.push(...l.zones);
        });

        const weeks = new Set();
        zones.forEach(z => {
            const startStr = z.startDate || z.date;
            const endStr = z.endDate || z.date;

            const s = startStr ? getWeekNumber(new Date(startStr)) : null;
            const e = endStr ? getWeekNumber(new Date(endStr)) : null;

            if (s) weeks.add(s);
            if (e) weeks.add(e);
            
            if (s && e && e > s) {
                // Add intermediate weeks
                for (let i = s + 1; i < e; i++) weeks.add(i);
            }
        });
        
        const sortedWeeks = Array.from(weeks).sort((a,b) => a - b);
        
        // Get current filter
        // We support 'weeks' (array)
        const currentWeeks = state.filters.weeks || [];
        
        this.elements.weekFilterContent.innerHTML = '';
        
        if (sortedWeeks.length === 0) {
            this.elements.weekFilterContent.innerHTML = `<div style="padding:0.5rem; color:#888;">${this.t('noDates')}</div>`;
            return;
        }

        sortedWeeks.forEach(week => {
            const div = document.createElement('div');
            div.className = 'week-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = week;
            // logic: if filter is empty, show all checked.
            checkbox.checked = currentWeeks.length === 0 || currentWeeks.includes(week) || currentWeeks.includes(String(week));
            
            const label = document.createElement('span');
            label.textContent = `v.${week}`;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            
            // Allow clicking row to toggle
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
            });

            this.elements.weekFilterContent.appendChild(div);
        });
    }

    updateDateRangeDisplay() {
        if (!this.elements.dateRangeText) return;
        
        const state = this.dataManager.getState();
        const filters = state.filters;
        
        if (!filters.weeks || filters.weeks.length === 0) {
            this.elements.dateRangeText.textContent = this.t('allWeeks') || 'All Weeks';
        } else {
            // numeric sort
            const sorted = [...filters.weeks].sort((a,b) => a-b);
            if (sorted.length === 1) {
                this.elements.dateRangeText.textContent = `v.${sorted[0]}`;
            } else {
                // Check if contiguous
                let contiguous = true;
                for(let i=0; i<sorted.length-1; i++) {
                    if (sorted[i+1] !== sorted[i] + 1) {
                        contiguous = false;
                        break;
                    }
                }
                
                if (contiguous) {
                    this.elements.dateRangeText.textContent = `v.${sorted[0]} - v.${sorted[sorted.length-1]}`;
                } else {
                    this.elements.dateRangeText.textContent = `v.${sorted.join(', v.')}`; // or truncated
                    if (this.elements.dateRangeText.textContent.length > 20) {
                         this.elements.dateRangeText.textContent = `v.${sorted[0]}... (${sorted.length})`;
                    }
                }
            }
        }
    }

    renderFilters() {
        this.populateWeekFilter();
        this.updateDateRangeDisplay();

        if (!this.elements.filterDisciplinesList) return;

        const state = this.dataManager.getState();
        const filters = state.filters;

        // Render Disciplines
        this.elements.filterDisciplinesList.innerHTML = '';
        state.disciplines.forEach(d => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = d.id;
            checkbox.checked = filters.disciplines.includes(d.id);
            
            checkbox.addEventListener('change', (e) => {
                const currentFilters = this.dataManager.getState().filters;
                let newDisciplines = [...currentFilters.disciplines];
                if (e.target.checked) {
                    newDisciplines.push(d.id);
                } else {
                    newDisciplines = newDisciplines.filter(id => id !== d.id);
                }
                this.dataManager.setFilters({ disciplines: newDisciplines });
            });

            const label = document.createElement('span');
            label.textContent = this.t(d.name);
            
            // Color indicator
            const dot = document.createElement('span');
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = d.color;

            div.appendChild(checkbox);
            div.appendChild(dot);
            div.appendChild(label);
            this.elements.filterDisciplinesList.appendChild(div);
        });

        // Render Statuses
        this.elements.filterStatusesList.innerHTML = '';
        state.statuses.forEach(s => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = s.id;
            checkbox.checked = filters.statuses.includes(s.id);
            
            checkbox.addEventListener('change', (e) => {
                const currentFilters = this.dataManager.getState().filters;
                let newStatuses = [...currentFilters.statuses];
                if (e.target.checked) {
                    newStatuses.push(s.id);
                } else {
                    newStatuses = newStatuses.filter(id => id !== s.id);
                }
                this.dataManager.setFilters({ statuses: newStatuses });
            });

            const label = document.createElement('span');
            label.textContent = this.t(s.name);
            
            const dot = document.createElement('span');
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = s.color;

            div.appendChild(checkbox);
            div.appendChild(dot);
            div.appendChild(label);
            this.elements.filterStatusesList.appendChild(div);
        });
    }

    handleStateChange(state) {
        // Re-render filters if disciplines or statuses changed
        this.renderFilters();
        this.renderLegend();
        this.renderSymbols();
    }

    renderSymbols() {
        if (!this.elements.symbolsGrid) return;

        const symbols = this.dataManager.getState().symbols || [];
        this.elements.symbolsGrid.innerHTML = '';

        symbols.forEach(symbol => {
            const div = document.createElement('div');
            div.className = 'symbol-item';
            div.draggable = true;
            
            // Drag Start
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'symbol',
                    symbolId: symbol.id,
                    width: 50, // Default size
                    height: 50
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });

            // Icon
            if (symbol.type === 'svg') {
                div.innerHTML = symbol.src;
            } else if (symbol.type === 'image') {
                const img = document.createElement('img');
                img.src = symbol.src;
                div.appendChild(img);
            }

            // Label
            const span = document.createElement('span');
            span.textContent = this.t(symbol.name);
            div.appendChild(span);

            this.elements.symbolsGrid.appendChild(div);
        });
    }

    // --- Initialization ---
    init() {
        // Initial setup or state recovery
        const state = this.dataManager.getState();
        
        // Set initial tool
        this.canvasManager.setTool('select');
        
        // Restore saved state
        if (state.activeLayoutId) {
            this.dataManager.setActiveLayout(state.activeLayoutId);
        }

        // Initial render
        this.renderLegend();
        this.renderSchedule();
        this.renderLayoutTabs();
        this.renderFilters();
        this.renderSymbols();
    }
}
