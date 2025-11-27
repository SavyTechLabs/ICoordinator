/**
 * Data Manager
 * Handles application state, data persistence, and import/export.
 */

class DataManager {
    constructor() {
        this.state = {
            projectInfo: {
                name: "Nytt Projekt",
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            },
            // Global Data
            customFields: [], // Array of custom field definitions
            schedule: [], // Imported schedule data
            disciplines: [
                { id: 'construction', name: 'discConstruction', color: '#EF4444' },
                { id: 'electrical', name: 'discElectrical', color: '#F59E0B' },
                { id: 'plumbing', name: 'discPlumbing', color: '#3B82F6' },
                { id: 'ventilation', name: 'discVentilation', color: '#10B981' }
            ],
            statuses: [
                { id: 'planned', name: 'statusPlanned', color: '#94A3B8' },
                { id: 'in-progress', name: 'statusInProgress', color: '#F59E0B' },
                { id: 'completed', name: 'statusCompleted', color: '#10B981' },
                { id: 'delayed', name: 'statusDelayed', color: '#EF4444' }
            ],
            viewMode: 'discipline', // 'discipline' or 'status'
            language: 'sv', // 'sv' or 'en'
            zoneNameMode: 'activity', // 'activity' or 'manual'
            
            // Filters
            filters: {
                text: '',
                disciplines: [], // Empty = all
                statuses: [], // Empty = all
                dateStart: null,
                dateEnd: null,
                week: '',
                showHidden: false
            },

            // Symbols
            symbols: [
                { id: 'north-arrow', name: 'Norrpil', type: 'svg', src: '<svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="currentColor"/></svg>' },
                { id: 'camera', name: 'Kamera', type: 'svg', src: '<svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="currentColor"/></svg>' },
                { id: 'warning', name: 'Varning', type: 'svg', src: '<svg viewBox="0 0 24 24"><path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V10H13V14Z" fill="#F59E0B"/></svg>' },
                { id: 'arrow', name: 'Pil', type: 'svg', src: '<svg viewBox="0 0 24 24"><path d="M19 15L13 21L11.59 19.59L15.17 16H4V4H6V14H15.17L11.59 10.41L13 9L19 15Z" fill="currentColor"/></svg>' }
            ],

            // Layouts Management
            activeLayoutId: 'default',
            layouts: [
                {
                    id: 'default',
                    name: 'Layout 1',
                    zones: [],
                    backgroundImage: null,
                    scale: 1,
                    pan: { x: 0, y: 0 }
                }
            ]
        };
        
        this.listeners = [];
        this.loadFromStorage();
    }

    // --- State Management ---

    getState() {
        return this.state;
    }

    getActiveLayout() {
        return this.state.layouts.find(l => l.id === this.state.activeLayoutId) || this.state.layouts[0];
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.state.projectInfo.lastModified = new Date().toISOString();
        this.notifyListeners();
        this.saveToStorage();
    }

    updateActiveLayout(layoutUpdates) {
        const activeId = this.state.activeLayoutId;
        const newLayouts = this.state.layouts.map(l => 
            l.id === activeId ? { ...l, ...layoutUpdates } : l
        );
        this.setState({ layouts: newLayouts });
    }

    setLanguage(lang) {
        this.setState({ language: lang });
    }

    setZoneNameMode(mode) {
        this.setState({ zoneNameMode: mode });
    }

    setBackgroundImage(dataUrl) {
        this.updateActiveLayout({ backgroundImage: dataUrl });
    }

    setViewMode(mode) {
        this.setState({ viewMode: mode });
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Zone Management ---

    addZone(zone) {
        const layout = this.getActiveLayout();
        const newZones = [...layout.zones, zone];
        this.updateActiveLayout({ zones: newZones });
    }

    updateZone(updatedZone) {
        const layout = this.getActiveLayout();
        const newZones = layout.zones.map(z => 
            z.id === updatedZone.id ? updatedZone : z
        );
        this.updateActiveLayout({ zones: newZones });
    }

    deleteZone(zoneId) {
        const layout = this.getActiveLayout();
        const newZones = layout.zones.filter(z => z.id !== zoneId);
        this.updateActiveLayout({ zones: newZones });
    }

    getZone(zoneId) {
        // Search in active layout first, but technically we might want to search all if we had global IDs
        // For now, assume interaction is only with active layout
        return this.getActiveLayout().zones.find(z => z.id === zoneId);
    }

    // --- Custom Fields ---

    addCustomField(field) {
        const newFields = [...this.state.customFields, field];
        this.setState({ customFields: newFields });
    }

    removeCustomField(fieldId) {
        const newFields = this.state.customFields.filter(f => f.id !== fieldId);
        this.setState({ customFields: newFields });
    }

    // --- Settings Management ---

    addDiscipline(discipline) {
        const newDisciplines = [...this.state.disciplines, discipline];
        this.setState({ disciplines: newDisciplines });
    }

    removeDiscipline(id) {
        const newDisciplines = this.state.disciplines.filter(d => d.id !== id);
        this.setState({ disciplines: newDisciplines });
    }

    updateDiscipline(updatedDiscipline) {
        const newDisciplines = this.state.disciplines.map(d => 
            d.id === updatedDiscipline.id ? updatedDiscipline : d
        );
        this.setState({ disciplines: newDisciplines });
    }

    addStatus(status) {
        const newStatuses = [...this.state.statuses, status];
        this.setState({ statuses: newStatuses });
    }

    removeStatus(id) {
        const newStatuses = this.state.statuses.filter(s => s.id !== id);
        this.setState({ statuses: newStatuses });
    }

    updateStatus(updatedStatus) {
        const newStatuses = this.state.statuses.map(s => 
            s.id === updatedStatus.id ? updatedStatus : s
        );
        this.setState({ statuses: newStatuses });
    }

    // --- Persistence ---

    saveToStorage() {
        try {
            localStorage.setItem('icoordinator_data', JSON.stringify(this.state));
        } catch (e) {
            console.error("Failed to save to localStorage", e);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('icoordinator_data');
            if (data) {
                let loadedState = JSON.parse(data);
                
                // Migration: If old structure (zones at root), move to default layout
                if (loadedState.zones && !loadedState.layouts) {
                    console.log("Migrating legacy state to multi-layout structure...");
                    loadedState = {
                        ...loadedState,
                        activeLayoutId: 'default',
                        layouts: [
                            {
                                id: 'default',
                                name: 'Layout 1',
                                zones: loadedState.zones || [],
                                backgroundImage: loadedState.backgroundImage || null,
                                scale: 1,
                                pan: { x: 0, y: 0 }
                            }
                        ]
                    };
                    // Remove legacy root properties
                    delete loadedState.zones;
                    delete loadedState.backgroundImage;
                }

                // Merge loaded state with default state to ensure new fields exist
                this.state = { ...this.state, ...loadedState };
                
                // Fix: Remove legacy 'cloud' symbol if present (it is now a tool)
                if (this.state.symbols) {
                    this.state.symbols = this.state.symbols.filter(s => s.id !== 'cloud');
                }
                
                // Ensure critical arrays exist
                if (!this.state.disciplines) {
                    this.state.disciplines = [
                        { id: 'construction', name: 'Bygg', color: '#EF4444' },
                        { id: 'electrical', name: 'El', color: '#F59E0B' },
                        { id: 'plumbing', name: 'VVS', color: '#3B82F6' },
                        { id: 'ventilation', name: 'Ventilation', color: '#10B981' }
                    ];
                }
                if (!this.state.statuses) {
                    this.state.statuses = [
                        { id: 'planned', name: 'Planerad', color: '#94A3B8' },
                        { id: 'in-progress', name: 'Pågående', color: '#F59E0B' },
                        { id: 'completed', name: 'Klar', color: '#10B981' },
                        { id: 'delayed', name: 'Försenad', color: '#EF4444' }
                    ];
                }
                
                // Ensure layouts exist if somehow missing after merge
                if (!this.state.layouts || this.state.layouts.length === 0) {
                     this.state.layouts = [{
                        id: 'default',
                        name: 'Layout 1',
                        zones: [],
                        backgroundImage: null,
                        scale: 1,
                        pan: { x: 0, y: 0 }
                    }];
                    this.state.activeLayoutId = 'default';
                }
            }
        } catch (e) {
            console.error("Failed to load from localStorage", e);
        }
    }

    // --- Import/Export ---

    exportProject(filename = "icoordinator_project.json") {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        
        // Ensure extension
        if (!filename.toLowerCase().endsWith('.json')) {
            filename += '.json';
        }
        
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let importedState = JSON.parse(event.target.result);
                    
                    // Migration: If old structure (zones at root), move to default layout
                    if (importedState.zones && !importedState.layouts) {
                        console.log("Migrating imported legacy project...");
                        importedState = {
                            ...importedState,
                            activeLayoutId: 'default',
                            layouts: [
                                {
                                    id: 'default',
                                    name: 'Layout 1',
                                    zones: importedState.zones || [],
                                    backgroundImage: importedState.backgroundImage || null,
                                    scale: 1,
                                    pan: { x: 0, y: 0 }
                                }
                            ]
                        };
                        delete importedState.zones;
                        delete importedState.backgroundImage;
                    }

                    // Basic validation could go here
                    this.setState(importedState);
                    resolve(importedState);
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Excel Import ---
    
    parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    setSchedule(scheduleData) {
        this.setState({ schedule: scheduleData });
    }

    // --- Layout Management ---

    addLayout(name) {
        const newLayout = {
            id: 'layout_' + Date.now(), // Simple ID generation
            name: name,
            zones: [],
            backgroundImage: null,
            scale: 1,
            pan: { x: 0, y: 0 }
        };
        
        const newLayouts = [...this.state.layouts, newLayout];
        this.setState({ 
            layouts: newLayouts,
            activeLayoutId: newLayout.id 
        });
    }

    setActiveLayout(layoutId) {
        if (this.state.layouts.find(l => l.id === layoutId)) {
            this.setState({ activeLayoutId: layoutId });
        }
    }

    deleteLayout(layoutId) {
        if (this.state.layouts.length <= 1) {
            alert("Du kan inte ta bort den sista layouten.");
            return;
        }

        const newLayouts = this.state.layouts.filter(l => l.id !== layoutId);
        let newActiveId = this.state.activeLayoutId;
        
        if (this.state.activeLayoutId === layoutId) {
            newActiveId = newLayouts[0].id;
        }

        this.setState({ 
            layouts: newLayouts,
            activeLayoutId: newActiveId
        });
    }

    renameLayout(layoutId, newName) {
        const newLayouts = this.state.layouts.map(l => 
            l.id === layoutId ? { ...l, name: newName } : l
        );
        this.setState({ layouts: newLayouts });
    }

    // --- Filter Management ---

    setFilters(newFilters) {
        this.setState({
            filters: { ...this.state.filters, ...newFilters }
        });
    }

    resetFilters() {
        this.setState({
            filters: {
                text: '',
                disciplines: [],
                statuses: [],
                dateStart: null,
                dateEnd: null,
                week: '',
                showHidden: false
            }
        });
    }

    // --- Symbol Management ---

    addSymbol(symbol) {
        const newSymbols = [...this.state.symbols, symbol];
        this.setState({ symbols: newSymbols });
    }
}
