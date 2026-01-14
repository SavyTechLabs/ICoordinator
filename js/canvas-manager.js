/**
 * Canvas Manager
 * Handles drawing, interactions, and rendering of the layout and zones.
 */

class CanvasManager {
    constructor(canvasId, dataManager, uiManager) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dataManager = dataManager;
        this.uiManager = uiManager;

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.isDragging = false;
        this.isDrawing = false;
        this.isResizing = false;
        this.isRotating = false;
        this.isSizingSymbol = false;
        
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.polyPoints = []; // For polygon drawing
        
        this.activeTool = 'select'; // 'select', 'draw', 'poly'
        this.selectedZoneIds = new Set(); // Changed from single ID to Set
        this.selectedZoneId = null; // Keep for backward compatibility/primary selection
        this.hoveredZoneId = null;
        this.resizeHandle = null; // 'tl', 'tr', 'bl', 'br' or index for poly

        this.backgroundImage = null;
        this.lastLoadedBg = null; // Track loaded bg to avoid loops
        this.lastLayoutId = null;
        
        this.clipboard = []; // For copy/paste
        this.contextMenu = document.getElementById('context-menu');

        // Debounced save function for view state
        this.saveViewStateDebounced = debounce(() => {
            this.dataManager.updateActiveLayout({
                scale: this.scale,
                pan: { x: this.offsetX, y: this.offsetY }
            });
        }, 500);

        // Subscribe to state changes
        this.dataManager.subscribe(this.handleStateChange.bind(this));

        this.initEventListeners();
        this.resizeCanvas();
        
        // Check for saved background on init
        const activeLayout = this.dataManager.getActiveLayout();
        if (activeLayout) {
            this.lastLayoutId = activeLayout.id;
            this.scale = activeLayout.scale || 1;
            this.offsetX = activeLayout.pan ? activeLayout.pan.x : 0;
            this.offsetY = activeLayout.pan ? activeLayout.pan.y : 0;
            this.uiManager.updateZoomLevel(Math.round(this.scale * 100));
            
            const savedBg = activeLayout.backgroundImage;
            if (savedBg) {
                this.lastLoadedBg = savedBg;
                const img = new Image();
                img.onload = () => {
                    this.setBackground(img, false);
                };
                img.onerror = (e) => {
                    console.error("Failed to load initial background", e);
                    this.lastLoadedBg = null;
                };
                img.src = savedBg;
            }
        }

        // Subscribe to data changes to redraw
        this.dataManager.subscribe((state) => {
            const currentLayout = this.dataManager.getActiveLayout();
            if (!currentLayout) return;

            // Check if layout changed
            if (currentLayout.id !== this.lastLayoutId) {
                this.lastLayoutId = currentLayout.id;
                // Restore view settings
                this.scale = currentLayout.scale || 1;
                this.offsetX = currentLayout.pan ? currentLayout.pan.x : 0;
                this.offsetY = currentLayout.pan ? currentLayout.pan.y : 0;
                this.uiManager.updateZoomLevel(Math.round(this.scale * 100));
            }

            const currentBg = currentLayout.backgroundImage;

            // Check if background image changed (e.g. import or layout switch)
            if (currentBg && currentBg !== this.lastLoadedBg) {
                console.log(`Loading background for layout ${currentLayout.id}...`);
                this.lastLoadedBg = currentBg;
                const img = new Image();
                img.onload = () => {
                    console.log(`Background loaded for layout ${currentLayout.id}`);
                    this.setBackground(img, false);
                };
                img.onerror = (e) => {
                    console.error(`Failed to load background for layout ${currentLayout.id}`, e);
                    // Reset lastLoadedBg so we can try again if needed, or at least we know it failed
                    this.lastLoadedBg = null; 
                };
                img.src = currentBg;
            } else if (!currentBg && this.backgroundImage) {
                // Layout has no background, clear it
                this.backgroundImage = null;
                this.lastLoadedBg = null;
                document.getElementById('empty-state').style.display = 'flex';
            }
            
            this.draw();
        });

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Context Menu Listeners
        document.addEventListener('click', () => this.hideContextMenu());
        document.getElementById('ctx-bring-front').addEventListener('click', () => this.bringToFront());
        document.getElementById('ctx-send-back').addEventListener('click', () => this.sendToBack());
        document.getElementById('ctx-copy').addEventListener('click', () => this.copySelected());
        document.getElementById('ctx-paste').addEventListener('click', () => this.pasteFromClipboard());
        document.getElementById('ctx-delete').addEventListener('click', () => this.deleteSelectedZones());
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (this.isDrawing) {
                // Cancel drawing
                this.isDrawing = false;
                this.polyPoints = [];
                this.tempZone = null;
                this.draw();
            } else if (this.selectedZoneIds.size > 0) {
                // Deselect
                this.clearSelection();
            }
        } else if (e.key === 'Enter') {
            if (this.isDrawing && (this.activeTool === 'poly' || this.activeTool === 'cloud' || this.activeTool === 'measure-area' || this.activeTool === 'draw-poly')) {
                // Finish polygon/polyline
                if (this.polyPoints.length > 1) {
                    this.finishPolygon();
                }
            }
        } else if (e.key === 'Delete') {
            // Only delete if not editing text (though text editing usually captures focus)
            if (this.selectedZoneIds.size > 0 && !this.isDrawing) {
                this.deleteSelectedZones();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            this.copySelected();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            this.pasteFromClipboard();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this.dataManager.undo();
            this.draw();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            this.dataManager.redo();
            this.draw();
        }
    }

    copySelected() {
        if (this.selectedZoneIds.size > 0) {
            this.clipboard = [];
            this.selectedZoneIds.forEach(id => {
                const zone = this.dataManager.getZone(id);
                if (zone) {
                    // Deep clone to avoid reference issues
                    this.clipboard.push(JSON.parse(JSON.stringify(zone)));
                }
            });
        }
    }

    pasteFromClipboard() {
        if (this.clipboard && this.clipboard.length > 0) {
            this.clearSelection();
            
            this.clipboard.forEach(item => {
                const newZone = JSON.parse(JSON.stringify(item));
                newZone.id = generateUUID();
                
                // Offset position
                const offset = 20 / this.scale;
                
                if (newZone.points) {
                    // Polygon/Cloud
                    newZone.points = newZone.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
                    // Recalculate bounds
                    if (newZone.x !== undefined) newZone.x += offset;
                    if (newZone.y !== undefined) newZone.y += offset;
                } else {
                    newZone.x += offset;
                    newZone.y += offset;
                    if (newZone.x2 !== undefined) newZone.x2 += offset;
                    if (newZone.y2 !== undefined) newZone.y2 += offset;
                }
                
                this.dataManager.addZone(newZone);
                this.addToSelection(newZone.id);
            });
            
            this.draw();
        }
    }

    handleContextMenu(e) {
        e.preventDefault();
        
        const pos = this.getMousePos(e);
        const zone = this.getZoneAt(pos);
        
        if (zone) {
            if (!this.selectedZoneIds.has(zone.id)) {
                this.clearSelection();
                this.selectZone(zone.id);
            }
        } else {
            this.clearSelection();
        }

        this.showContextMenu(e.clientX, e.clientY);
    }

    showContextMenu(x, y) {
        if (!this.contextMenu) return;

        const hasSelection = this.selectedZoneIds.size > 0;
        const hasClipboard = this.clipboard.length > 0;

        const bringFrontBtn = document.getElementById('ctx-bring-front');
        const sendBackBtn = document.getElementById('ctx-send-back');
        const copyBtn = document.getElementById('ctx-copy');
        const pasteBtn = document.getElementById('ctx-paste');
        const deleteBtn = document.getElementById('ctx-delete');

        if (hasSelection) {
            bringFrontBtn.classList.remove('disabled');
            sendBackBtn.classList.remove('disabled');
            copyBtn.classList.remove('disabled');
            deleteBtn.classList.remove('disabled');
        } else {
            bringFrontBtn.classList.add('disabled');
            sendBackBtn.classList.add('disabled');
            copyBtn.classList.add('disabled');
            deleteBtn.classList.add('disabled');
        }

        if (hasClipboard) {
            pasteBtn.classList.remove('disabled');
        } else {
            pasteBtn.classList.add('disabled');
        }

        // Adjust position if close to edge
        const menuWidth = 180;
        const menuHeight = 200; // Increased height for new items
        
        let finalX = x;
        let finalY = y;

        if (x + menuWidth > window.innerWidth) {
            finalX = x - menuWidth;
        }
        
        if (y + menuHeight > window.innerHeight) {
            finalY = y - menuHeight;
        }

        this.contextMenu.style.left = `${finalX}px`;
        this.contextMenu.style.top = `${finalY}px`;
        this.contextMenu.classList.remove('hidden');
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
    }

    bringToFront() {
        if (this.selectedZoneIds.size === 0) return;
        
        this.dataManager.saveState();

        const layout = this.dataManager.getActiveLayout();
        const zones = layout.zones;
        const selected = [];
        const others = [];
        
        zones.forEach(z => {
            if (this.selectedZoneIds.has(z.id)) {
                selected.push(z);
            } else {
                others.push(z);
            }
        });
        
        const newOrder = [...others, ...selected];
        this.dataManager.updateActiveLayout({ zones: newOrder });
        this.draw();
    }

    sendToBack() {
        if (this.selectedZoneIds.size === 0) return;
        
        this.dataManager.saveState();

        const layout = this.dataManager.getActiveLayout();
        const zones = layout.zones;
        const selected = [];
        const others = [];
        
        zones.forEach(z => {
            if (this.selectedZoneIds.has(z.id)) {
                selected.push(z);
            } else {
                others.push(z);
            }
        });
        
        const newOrder = [...selected, ...others];
        this.dataManager.updateActiveLayout({ zones: newOrder });
        this.draw();
    }

    handleDoubleClick(e) {
        const pos = this.getMousePos(e);
        const zone = this.getZoneAt(pos);
        
        if (zone && zone.type === 'text') {
            this.startEditingText(zone);
        }
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
        this.draw();
    }

    // --- Coordinate Conversion ---

    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left - this.offsetX) / this.scale,
            y: (evt.clientY - rect.top - this.offsetY) / this.scale
        };
    }

    // --- Input Handling ---

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        if (this.isSizingSymbol && this.tempZone) {
            // Commit Symbol Placement
            const newZone = {
                ...this.tempZone,
                id: generateUUID(),
                opacity: 1 // Reset opacity
            };
            
            // Ensure minimum size
            if (newZone.width < 5 || newZone.height < 5) {
                newZone.width = 50;
                newZone.height = 50;
            }

            this.dataManager.addZone(newZone);
            this.isSizingSymbol = false;
            this.tempZone = null;
            this.selectZone(newZone.id);
            this.setTool('select');
            this.draw();
            return;
        }

        if (this.activeTool === 'text') {
            this.isDrawing = true;
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                type: 'text'
            };
            this.startPos = pos;
            return;
        }

        this.startPos = pos;

        if (this.activeTool === 'calibrate') {
            this.isDrawing = true;
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                x2: pos.x,
                y2: pos.y,
                type: 'calibration-line'
            };
        } else if (this.activeTool === 'measure-length' || this.activeTool === 'arrow' || this.activeTool === 'line') {
            this.isDrawing = true;
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                x2: pos.x,
                y2: pos.y,
                type: this.activeTool
            };
        } else if (this.activeTool === 'measure-area') {
            // Polygon-like drawing for area
            if (this.polyPoints.length === 0) {
                this.polyPoints.push(pos);
                this.isDrawing = true;
            } else {
                // Check if closing loop (near first point)
                const first = this.polyPoints[0];
                const dist = Math.sqrt(Math.pow(pos.x - first.x, 2) + Math.pow(pos.y - first.y, 2));
                
                if (dist < 10 / this.scale && this.polyPoints.length > 2) {
                    this.finishPolygon();
                    return;
                }
                this.polyPoints.push(pos);
            }
            this.draw();
        } else if (this.activeTool === 'draw' || this.activeTool === 'ellipse' || this.activeTool === 'draw-rect') {
            this.isDrawing = true;
            // Create a temporary zone
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                type: this.activeTool === 'ellipse' ? 'ellipse' : 'rect'
            };
        } else if (this.activeTool === 'poly' || this.activeTool === 'cloud' || this.activeTool === 'measure-area' || this.activeTool === 'draw-poly') {
            // Polygon/Cloud drawing logic
            if (this.polyPoints.length === 0) {
                this.polyPoints.push(pos);
                this.isDrawing = true;
            } else {
                // Check if closing loop (near first point)
                const first = this.polyPoints[0];
                const dist = Math.sqrt(Math.pow(pos.x - first.x, 2) + Math.pow(pos.y - first.y, 2));
                
                if (dist < 10 / this.scale && this.polyPoints.length > 2) {
                    this.finishPolygon();
                    return;
                }
                this.polyPoints.push(pos);
            }
            this.draw();
        } else if (this.activeTool === 'select') {
            // Check for resize handles first if a single zone is selected
            if (this.selectedZoneIds.size === 1) {
                const zoneId = Array.from(this.selectedZoneIds)[0];
                const zone = this.dataManager.getZone(zoneId);
                this.resizeHandle = this.getResizeHandle(pos, zone);
                
                if (this.resizeHandle === 'rotate') {
                    this.isRotating = true;
                    this.dataManager.saveState();
                    return;
                }

                if (this.resizeHandle === 'remove-start' || this.resizeHandle === 'remove-end') {
                    // Remove point
                    let newPoints = [...zone.points];
                    if (this.resizeHandle === 'remove-start') {
                        newPoints.shift();
                    } else {
                        newPoints.pop();
                    }

                    if (newPoints.length < 2) {
                        // Delete zone if less than 2 points
                        this.dataManager.deleteZone(zone.id);
                        this.clearSelection();
                    } else {
                        // Recalculate bounds
                        const x = Math.min(...newPoints.map(p => p.x));
                        const y = Math.min(...newPoints.map(p => p.y));
                        const width = Math.max(...newPoints.map(p => p.x)) - x;
                        const height = Math.max(...newPoints.map(p => p.y)) - y;

                        this.dataManager.updateZone({
                            ...zone,
                            points: newPoints,
                            x, y, width, height
                        });
                    }
                    this.draw();
                    return;
                }

                if (this.resizeHandle === 'add-start' || this.resizeHandle === 'add-end') {
                    // Continue drawing from existing polyline
                    this.editingZoneId = zone.id;
                    this.activeTool = 'draw-poly';
                    this.isDrawing = true;
                    
                    // If adding to start, we need to reverse points so we append to the "end" of our drawing array
                    // But wait, if we reverse, we need to reverse back when saving.
                    // Simpler: Just track if we are prepending or appending.
                    // Actually, standard drawing appends.
                    // If 'add-end', we just load points as is.
                    // If 'add-start', we reverse points, so new points are appended, then we reverse back on finish.
                    
                    if (this.resizeHandle === 'add-start') {
                        this.polyPoints = [...zone.points].reverse();
                        this.isReversePoly = true;
                    } else {
                        this.polyPoints = [...zone.points];
                        this.isReversePoly = false;
                    }
                    
                    // Add the first new point immediately at mouse pos? 
                    // No, user clicked the handle. We are now in "drawing mode" with the last point being the handle.
                    // The next click will add a point.
                    this.uiManager.updateToolState('draw-poly');
                    this.draw();
                    return;
                }
                
                if (this.resizeHandle !== null) {
                    this.isResizing = true;
                    this.dataManager.saveState();
                    return;
                }
            }

            // Check for zone selection
            const clickedZone = this.getZoneAt(pos);
            
            if (clickedZone) {
                if (e.shiftKey) {
                    // Toggle selection
                    if (this.selectedZoneIds.has(clickedZone.id)) {
                        this.deselectZone(clickedZone.id);
                    } else {
                        this.addToSelection(clickedZone.id);
                    }
                } else {
                    // If clicking an already selected zone, keep selection (for drag)
                    // If clicking a new zone, clear and select new
                    if (!this.selectedZoneIds.has(clickedZone.id)) {
                        this.selectZone(clickedZone.id);
                    }
                }
                this.isDragging = true;
                this.dataManager.saveState();
            } else {
                if (!e.shiftKey) {
                    this.clearSelection();
                }
                // Start panning if clicking on empty space
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
            }
            this.draw();
        }
    }

    selectZone(id) {
        this.selectedZoneIds.clear();
        this.selectedZoneIds.add(id);
        this.selectedZoneId = id; // Legacy support
        this.uiManager.selectZone(this.selectedZoneIds); // Update UI
    }

    addToSelection(id) {
        this.selectedZoneIds.add(id);
        this.selectedZoneId = id; // Set primary to last selected
        this.uiManager.selectZone(this.selectedZoneIds);
    }

    deselectZone(id) {
        this.selectedZoneIds.delete(id);
        if (this.selectedZoneId === id) {
            this.selectedZoneId = this.selectedZoneIds.size > 0 ? Array.from(this.selectedZoneIds)[0] : null;
        }
        this.uiManager.selectZone(this.selectedZoneIds);
    }

    clearSelection() {
        this.selectedZoneIds.clear();
        this.selectedZoneId = null;
        this.uiManager.selectZone(this.selectedZoneIds);
    }

    deleteSelectedZones() {
        if (this.selectedZoneIds.size === 0) return;
        
        if (confirm(this.uiManager.t('confirmDeleteZone'))) {
            this.selectedZoneIds.forEach(id => {
                this.dataManager.deleteZone(id);
            });
            this.clearSelection();
            this.draw();
        }
    }

    handleMouseMove(e) {
        let pos = this.getMousePos(e);

        // Axis Locking with Shift
        if (e.shiftKey && this.isDrawing) {
            let anchor = null;
            
            if (this.activeTool === 'poly' || this.activeTool === 'cloud' || this.activeTool === 'measure-area' || this.activeTool === 'draw-poly') {
                if (this.polyPoints.length > 0) {
                    anchor = this.polyPoints[this.polyPoints.length - 1];
                }
            } else if (this.startPos) {
                anchor = this.startPos;
            }

            if (anchor) {
                const dx = Math.abs(pos.x - anchor.x);
                const dy = Math.abs(pos.y - anchor.y);
                if (dx > dy) {
                    pos.y = anchor.y; // Snap to horizontal
                } else {
                    pos.x = anchor.x; // Snap to vertical
                }
            }
        }

        this.currentPos = pos;

        if (this.isSizingSymbol && this.tempZone) {
            const width = pos.x - this.startPos.x;
            const height = pos.y - this.startPos.y;
            
            // Aspect Ratio Lock
            // Default to 1:1 if not specified
            const ratio = 1; 
            
            // Determine dominant axis for sizing
            const size = Math.max(Math.abs(width), Math.abs(height));
            
            // Apply ratio (assuming 1:1 for now as most icons are square)
            // If we had specific ratios, we'd use them here.
            
            this.tempZone.width = size;
            this.tempZone.height = size / ratio;
            
            // Adjust position based on drag direction (keep start pos as anchor)
            this.tempZone.x = width < 0 ? this.startPos.x - size : this.startPos.x;
            this.tempZone.y = height < 0 ? this.startPos.y - (size / ratio) : this.startPos.y;
            
            this.draw();
            return;
        }

        if (this.activeTool === 'calibrate' && this.isDrawing) {
            this.tempZone.x2 = pos.x;
            this.tempZone.y2 = pos.y;
            this.draw();
        } else if ((this.activeTool === 'measure-length' || this.activeTool === 'arrow' || this.activeTool === 'line') && this.isDrawing) {
            this.tempZone.x2 = pos.x;
            this.tempZone.y2 = pos.y;
            this.draw();
        } else if (this.activeTool === 'measure-area' && this.isDrawing) {
            this.draw(); // Redraw to show line to cursor
        } else if ((this.activeTool === 'draw' || this.activeTool === 'ellipse' || this.activeTool === 'text' || this.activeTool === 'draw-rect') && this.isDrawing) {
            this.tempZone.width = pos.x - this.startPos.x;
            this.tempZone.height = pos.y - this.startPos.y;
            this.draw();
        } else if ((this.activeTool === 'poly' || this.activeTool === 'cloud' || this.activeTool === 'draw-poly') && this.isDrawing) {
            this.draw(); // Redraw to show line to cursor
        } else if (this.isRotating && this.selectedZoneId) {
            const zone = this.dataManager.getZone(this.selectedZoneId);
            const cx = zone.x + zone.width / 2;
            const cy = zone.y + zone.height / 2;
            
            // Calculate angle
            const angle = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI;
            // Offset by 90 degrees because handle is at top (-90 deg)
            const rotation = angle + 90;
            
            this.dataManager.updateZone({
                ...zone,
                rotation: rotation
            }, false);
        } else if (this.isDragging && this.selectedZoneIds.size > 0) {
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;
            
            // Update all selected zones
            this.selectedZoneIds.forEach(id => {
                const zone = this.dataManager.getZone(id);
                if (!zone) return;

                let updatedZone;
                if (zone.type === 'polygon' || zone.type === 'cloud') {
                    const newPoints = zone.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    updatedZone = { ...zone, points: newPoints };
                } else {
                    updatedZone = {
                        ...zone,
                        x: zone.x + dx,
                        y: zone.y + dy
                    };
                }
                this.dataManager.updateZone(updatedZone, false);
            });
            
            this.startPos = pos; // Reset start pos for continuous drag
        } else if (this.isResizing && this.selectedZoneIds.size === 1) {
            const zoneId = Array.from(this.selectedZoneIds)[0];
            const zone = this.dataManager.getZone(zoneId);
            this.resizeZone(zone, pos);
        } else if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.offsetX += dx;
            this.offsetY += dy;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.draw();
        } else {
            // Hover effects
            const hovered = this.getZoneAt(pos);
            if (hovered?.id !== this.hoveredZoneId) {
                this.hoveredZoneId = hovered?.id || null;
                this.canvas.style.cursor = hovered ? 'move' : 'default';
                this.draw();
            }
            
            // Cursor for resize handles
            if (this.selectedZoneId && !this.isDragging) {
                const zone = this.dataManager.getZone(this.selectedZoneId);
                const handle = this.getResizeHandle(pos, zone);
                if (handle !== null) {
                    this.canvas.style.cursor = 'crosshair'; // Generic resize cursor for points
                } else if (!hovered) {
                    this.canvas.style.cursor = 'default';
                }
            }
        }
    }

    handleMouseUp(e) {
        if (this.activeTool === 'calibrate' && this.isDrawing) {
            this.isDrawing = false;
            const dx = this.tempZone.x2 - this.tempZone.x;
            const dy = this.tempZone.y2 - this.tempZone.y;
            const distPixels = Math.sqrt(dx*dx + dy*dy);
            
            if (distPixels > 10) {
                const distMeters = prompt(this.uiManager.t('enterDistanceMeters'), "1.0");
                if (distMeters && !isNaN(parseFloat(distMeters))) {
                    const meters = parseFloat(distMeters);
                    const pixelsPerMeter = distPixels / meters;
                    
                    this.dataManager.updateActiveLayout({
                        calibrationScale: pixelsPerMeter
                    });
                    
                    alert(`${this.uiManager.t('calibrationSaved')}: ${pixelsPerMeter.toFixed(2)} px/m`);
                }
            }
            this.tempZone = null;
            this.setTool('select');
            this.draw();
            return;
        }

        if ((this.activeTool === 'measure-length' || this.activeTool === 'arrow' || this.activeTool === 'line') && this.isDrawing) {
            this.isDrawing = false;
            const dx = this.tempZone.x2 - this.tempZone.x;
            const dy = this.tempZone.y2 - this.tempZone.y;
            const distPixels = Math.sqrt(dx*dx + dy*dy);
            
            if (distPixels > 5) {
                const zone = {
                    id: generateUUID(),
                    x: this.tempZone.x,
                    y: this.tempZone.y,
                    x2: this.tempZone.x2,
                    y2: this.tempZone.y2,
                    type: this.activeTool,
                    color: '#FF0000',
                    opacity: 1,
                    name: this.uiManager.t(this.activeTool === 'measure-length' ? 'length' : (this.activeTool === 'arrow' ? 'arrow' : 'line')),
                    discipline: '',
                    status: '',
                    comments: '',
                    customData: {}
                };
                this.dataManager.addZone(zone);
                this.selectZone(zone.id);
                this.setTool('select');
            }
            this.tempZone = null;
            this.draw();
            return;
        }

        if (this.activeTool === 'text' && this.isDrawing) {
            this.isDrawing = false;
            
            // Normalize zone
            const width = Math.abs(this.tempZone.width);
            const height = Math.abs(this.tempZone.height);
            const x = Math.min(this.startPos.x, this.currentPos.x);
            const y = Math.min(this.startPos.y, this.currentPos.y);

            // Default size if click instead of drag
            const finalWidth = width < 10 ? 100 : width;
            const finalHeight = height < 10 ? 20 : height;
            
            // Calculate font size based on height (approx 80% of box height)
            const fontSize = Math.max(10, Math.round(finalHeight * 0.8));

            const zone = {
                id: generateUUID(),
                x: x,
                y: y,
                width: finalWidth,
                height: finalHeight,
                type: 'text',
                color: '#000000',
                opacity: 1,
                name: '', // Start empty
                discipline: '',
                status: '',
                comments: '',
                customData: { fontSize: fontSize }
            };
            
            this.dataManager.addZone(zone);
            this.selectZone(zone.id);
            this.setTool('select');
            this.tempZone = null;
            this.draw();
            
            // Start editing immediately
            this.startEditingText(zone);
            return;
        }

        if ((this.activeTool === 'draw' || this.activeTool === 'ellipse' || this.activeTool === 'draw-rect') && this.isDrawing) {
            this.isDrawing = false;
            // Normalize zone (negative width/height)
            const zone = {
                id: generateUUID(),
                x: Math.min(this.startPos.x, this.currentPos.x),
                y: Math.min(this.startPos.y, this.currentPos.y),
                width: Math.abs(this.tempZone.width),
                height: Math.abs(this.tempZone.height),
                type: this.activeTool === 'ellipse' ? 'ellipse' : (this.activeTool === 'draw-rect' ? 'draw-rect' : 'rect'),
                color: '#2563EB', // Default color
                opacity: 0.5,
                name: this.uiManager.t(this.activeTool === 'ellipse' ? 'ellipse' : (this.activeTool === 'draw-rect' ? 'rectangle' : 'newZone')),
                discipline: '',
                status: 'planned',
                comments: '',
                customData: {}
            };
            
            // Only add if it has some size
            if (zone.width > 5 && zone.height > 5) {
                this.dataManager.addZone(zone);
                this.selectedZoneId = zone.id;
                this.uiManager.selectZone(zone.id);
                // Switch back to select tool after drawing
                this.setTool('select');
            }
            this.tempZone = null;
        }
        // Note: Polygon drawing doesn't end on mouse up, it ends on closing loop
        
        if (this.isPanning) {
            // Save pan state (debounced)
            this.saveViewStateDebounced();
        }

        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.isPanning = false;
        this.resizeHandle = null;
        this.draw();
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.max(0.1, Math.min(5, this.scale + delta));
        
        // Calculate mouse position in world coordinates before zoom
        const mousePos = this.getMousePos(e);
        
        // Update scale
        const oldScale = this.scale;
        this.scale = newScale;
        
        // Adjust offset to keep mouse position stable
        // mousePos = (screenPos - offset) / scale
        // screenPos = mousePos * scale + offset
        // We want screenPos to be the same before and after zoom
        // mousePos * oldScale + oldOffset = mousePos * newScale + newOffset
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / oldScale);
        this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / oldScale);
        
        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));
        
        // Save view state (debounced)
        this.saveViewStateDebounced();

        this.draw();
    }

    zoomToFit() {
        if (!this.backgroundImage) return;

        // Calculate scale to fit
        const scaleX = this.canvas.width / this.backgroundImage.width;
        const scaleY = this.canvas.height / this.backgroundImage.height;
        this.scale = Math.min(scaleX, scaleY) * 0.9; // 90% fit
        
        // Update UI zoom level
        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));

        // Center image
        this.offsetX = (this.canvas.width - this.backgroundImage.width * this.scale) / 2;
        this.offsetY = (this.canvas.height - this.backgroundImage.height * this.scale) / 2;
        
        this.draw();
    }

    // --- Logic ---

    setTool(tool) {
        this.activeTool = tool;
        this.canvas.style.cursor = (tool === 'draw' || tool === 'poly' || tool === 'cloud') ? 'crosshair' : 'default';
        this.uiManager.updateToolState(tool);
        this.polyPoints = []; // Reset poly points if switching tools
        this.isDrawing = false;
    }

    getZoneAt(pos) {
        // Iterate in reverse to select top-most
        // Only check visible zones!
        const zones = this.getVisibleZones();
        
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            if (z.type === 'polygon' || z.type === 'cloud' || z.type === 'measure-area') {
                if (this.isPointInPolygon(pos, z.points)) {
                    return z;
                }
            } else if (z.type === 'draw-poly') {
                // Check distance to any segment
                if (z.points && z.points.length > 1) {
                    for (let j = 0; j < z.points.length - 1; j++) {
                        const p1 = z.points[j];
                        const p2 = z.points[j+1];
                        const dist = this.distToSegment(pos, p1, p2);
                        if (dist < 10 / this.scale) return z;
                    }
                }
            } else if (z.type === 'measure-length' || z.type === 'arrow' || z.type === 'line') {
                // Check distance to line segment
                const dist = this.distToSegment(pos, {x: z.x, y: z.y}, {x: z.x2, y: z.y2});
                if (dist < 10 / this.scale) return z;
            } else if (z.type === 'ellipse') {
                // Check if point is inside ellipse
                const cx = z.x + z.width / 2;
                const cy = z.y + z.height / 2;
                const rx = z.width / 2;
                const ry = z.height / 2;
                // Avoid division by zero
                if (rx > 0 && ry > 0) {
                    const normalized = Math.pow(pos.x - cx, 2) / Math.pow(rx, 2) + Math.pow(pos.y - cy, 2) / Math.pow(ry, 2);
                    if (normalized <= 1) return z;
                }
            } else {
                if (pos.x >= z.x && pos.x <= z.x + z.width &&
                    pos.y >= z.y && pos.y <= z.y + z.height) {
                    return z;
                }
            }
        }
        return null;
    }

    distToSegment(p, v, w) {
        const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
        if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
        return Math.sqrt((p.x - proj.x)**2 + (p.y - proj.y)**2);
    }

    isPointInPolygon(point, vs) {
        // Ray-casting algorithm based on
        // https://github.com/substack/point-in-polygon
        var x = point.x, y = point.y;
        var inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            var xi = vs[i].x, yi = vs[i].y;
            var xj = vs[j].x, yj = vs[j].y;
            
            var intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    getResizeHandle(pos, zone) {
        const handleSize = 10 / this.scale;
        
        if (zone.type === 'symbol') {
            // Check rotation handle
            const cx = zone.x + zone.width / 2;
            const cy = zone.y - 20 / this.scale;
            if (Math.abs(pos.x - cx) < handleSize && Math.abs(pos.y - cy) < handleSize) {
                return 'rotate';
            }
        }

        if (zone.type === 'measure-length' || zone.type === 'calibration-line' || zone.type === 'arrow' || zone.type === 'line') {
            if (Math.abs(pos.x - zone.x) < handleSize && Math.abs(pos.y - zone.y) < handleSize) return 'start';
            if (Math.abs(pos.x - zone.x2) < handleSize && Math.abs(pos.y - zone.y2) < handleSize) return 'end';
            return null;
        }

        if (zone.type === 'polygon' || zone.type === 'cloud' || zone.type === 'measure-area' || zone.type === 'draw-poly') {
            // Check each vertex
            for (let i = 0; i < zone.points.length; i++) {
                const p = zone.points[i];
                if (Math.abs(pos.x - p.x) < handleSize && Math.abs(pos.y - p.y) < handleSize) {
                    return i; // Return index of vertex
                }
            }

            // Check for "Continue" handles (Plus signs) for draw-poly
            if (zone.type === 'draw-poly' && zone.points.length > 0) {
                const start = zone.points[0];
                const end = zone.points[zone.points.length - 1];
                
                // Start handle:
                if (zone.points.length > 1) {
                    // Vector from p1 to p0
                    const p0 = zone.points[0];
                    const p1 = zone.points[1];
                    const dx = p0.x - p1.x;
                    const dy = p0.y - p1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const offset = 20 / this.scale;
                    const hx = p0.x + (dx/len) * offset;
                    const hy = p0.y + (dy/len) * offset;
                    
                    if (Math.abs(pos.x - hx) < handleSize && Math.abs(pos.y - hy) < handleSize) return 'add-start';

                    // Remove handle (Minus sign)
                    const offsetMinus = 35 / this.scale;
                    const hxMinus = p0.x + (dx/len) * offsetMinus;
                    const hyMinus = p0.y + (dy/len) * offsetMinus;
                    if (Math.abs(pos.x - hxMinus) < handleSize && Math.abs(pos.y - hyMinus) < handleSize) return 'remove-start';
                }

                // End handle:
                if (zone.points.length > 1) {
                    const pn = zone.points[zone.points.length - 1];
                    const pn1 = zone.points[zone.points.length - 2];
                    const dx = pn.x - pn1.x;
                    const dy = pn.y - pn1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const offset = 20 / this.scale;
                    const hx = pn.x + (dx/len) * offset;
                    const hy = pn.y + (dy/len) * offset;
                    
                    if (Math.abs(pos.x - hx) < handleSize && Math.abs(pos.y - hy) < handleSize) return 'add-end';

                    // Remove handle (Minus sign)
                    const offsetMinus = 35 / this.scale;
                    const hxMinus = pn.x + (dx/len) * offsetMinus;
                    const hyMinus = pn.y + (dy/len) * offsetMinus;
                    if (Math.abs(pos.x - hxMinus) < handleSize && Math.abs(pos.y - hyMinus) < handleSize) return 'remove-end';
                }
            }

            return null;
        } else {
            // Check corners
            if (Math.abs(pos.x - zone.x) < handleSize && Math.abs(pos.y - zone.y) < handleSize) return 'tl';
            if (Math.abs(pos.x - (zone.x + zone.width)) < handleSize && Math.abs(pos.y - zone.y) < handleSize) return 'tr';
            if (Math.abs(pos.x - zone.x) < handleSize && Math.abs(pos.y - (zone.y + zone.height)) < handleSize) return 'bl';
            if (Math.abs(pos.x - (zone.x + zone.width)) < handleSize && Math.abs(pos.y - (zone.y + zone.height)) < handleSize) return 'br';
            return null;
        }
    }

    resizeZone(zone, pos) {
        if (zone.type === 'measure-length' || zone.type === 'calibration-line' || zone.type === 'arrow' || zone.type === 'line') {
            if (this.resizeHandle === 'start') {
                this.dataManager.updateZone({ ...zone, x: pos.x, y: pos.y }, false);
            } else if (this.resizeHandle === 'end') {
                this.dataManager.updateZone({ ...zone, x2: pos.x, y2: pos.y }, false);
            }
            return;
        }

        if (zone.type === 'text') {
            // Special resize for text: Scale font size with height
            let newHeight = zone.height;
            let newY = zone.y;

            if (this.resizeHandle.includes('t')) {
                const dy = pos.y - zone.y;
                newY += dy;
                newHeight -= dy;
            }
            if (this.resizeHandle.includes('b')) {
                newHeight = pos.y - zone.y;
            }

            if (newHeight > 5) {
                // Auto-scaling font logic REMOVED to keep font size fixed
                // const newFontSize = Math.round(newHeight / 1.2);
                
                this.dataManager.updateZone({
                    ...zone,
                    y: newY,
                    height: newHeight,
                    width: zone.width // Keep width or recalculate if linked? Text width might change if font changed, but we removed that.
                }, false);
            }
            return;
        }

        if (zone.type === 'polygon' || zone.type === 'cloud' || zone.type === 'measure-area' || zone.type === 'draw-poly') {
            // Move vertex
            const index = this.resizeHandle;
            if (index !== null && typeof index === 'number' && index >= 0 && index < zone.points.length) {
                const newPoints = [...zone.points];
                newPoints[index] = { x: pos.x, y: pos.y };
                
                // Recalculate bounds
                const x = Math.min(...newPoints.map(p => p.x));
                const y = Math.min(...newPoints.map(p => p.y));
                const width = Math.max(...newPoints.map(p => p.x)) - x;
                const height = Math.max(...newPoints.map(p => p.y)) - y;

                this.dataManager.updateZone({
                    ...zone,
                    points: newPoints,
                    x, y, width, height
                }, false);
            }
        } else {
            let newX = zone.x;
            let newY = zone.y;
            let newW = zone.width;
            let newH = zone.height;

            if (this.resizeHandle.includes('l')) {
                const dx = pos.x - zone.x;
                newX += dx;
                newW -= dx;
            }
            if (this.resizeHandle.includes('r')) {
                newW = pos.x - zone.x;
            }
            if (this.resizeHandle.includes('t')) {
                const dy = pos.y - zone.y;
                newY += dy;
                newH -= dy;
            }
            if (this.resizeHandle.includes('b')) {
                newH = pos.y - zone.y;
            }

            // Prevent negative size
            if (newW > 5 && newH > 5) {
                this.dataManager.updateZone({
                    ...zone,
                    x: newX,
                    y: newY,
                    width: newW,
                    height: newH
                }, false);
            }
        }
    }

    finishPolygon() {
        this.isDrawing = false;
        
        // Handle editing existing zone
        if (this.editingZoneId) {
            const zone = this.dataManager.getZone(this.editingZoneId);
            if (zone) {
                let finalPoints = [...this.polyPoints];
                if (this.isReversePoly) {
                    finalPoints.reverse();
                }
                
                // Recalculate bounds
                const x = Math.min(...finalPoints.map(p => p.x));
                const y = Math.min(...finalPoints.map(p => p.y));
                const width = Math.max(...finalPoints.map(p => p.x)) - x;
                const height = Math.max(...finalPoints.map(p => p.y)) - y;

                this.dataManager.updateZone({
                    ...zone,
                    points: finalPoints,
                    x, y, width, height
                });
                this.selectZone(zone.id);
            }
            
            this.editingZoneId = null;
            this.isReversePoly = false;
            this.polyPoints = [];
            this.setTool('select');
            this.draw();
            return;
        }

        let type = 'polygon';
        if (this.activeTool === 'cloud') type = 'cloud';
        if (this.activeTool === 'measure-area') type = 'measure-area';
        if (this.activeTool === 'draw-poly') type = 'draw-poly';

        const zone = {
            id: generateUUID(),
            type: type,
            points: [...this.polyPoints],
            // Calculate bounding box for simple checks
            x: Math.min(...this.polyPoints.map(p => p.x)),
            y: Math.min(...this.polyPoints.map(p => p.y)),
            width: Math.max(...this.polyPoints.map(p => p.x)) - Math.min(...this.polyPoints.map(p => p.x)),
            height: Math.max(...this.polyPoints.map(p => p.y)) - Math.min(...this.polyPoints.map(p => p.y)),
            color: this.activeTool === 'cloud' ? '#94A3B8' : (this.activeTool === 'measure-area' ? '#FF0000' : '#2563EB'),
            opacity: 0.5,
            name: this.activeTool === 'cloud' ? this.uiManager.t('cloud') : (this.activeTool === 'measure-area' ? this.uiManager.t('area') : (this.activeTool === 'draw-poly' ? this.uiManager.t('polyline') : this.uiManager.t('newPolygon'))),
            discipline: '',
            status: 'planned',
            comments: '',
            customData: {}
        };

        this.dataManager.addZone(zone);
        this.selectedZoneId = zone.id;
        this.uiManager.selectZone(zone.id);
        this.polyPoints = [];
        this.setTool('select');
    }

    // --- Rendering ---

    setBackground(imageOrCanvas, saveToState = true) {
        this.backgroundImage = imageOrCanvas;
        
        // Calculate scale to fit
        const scaleX = this.canvas.width / imageOrCanvas.width;
        const scaleY = this.canvas.height / imageOrCanvas.height;
        this.scale = Math.min(scaleX, scaleY) * 0.9; // 90% fit
        
        // Update UI zoom level
        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));

        // Center image
        this.offsetX = (this.canvas.width - imageOrCanvas.width * this.scale) / 2;
        this.offsetY = (this.canvas.height - imageOrCanvas.height * this.scale) / 2;
        
        this.draw();
        
        // Hide empty state
        document.getElementById('empty-state').style.display = 'none';

        if (saveToState) {
            try {
                let dataUrl;
                if (imageOrCanvas instanceof HTMLCanvasElement) {
                    dataUrl = imageOrCanvas.toDataURL();
                } else {
                    const canvas = document.createElement('canvas');
                    canvas.width = imageOrCanvas.width;
                    canvas.height = imageOrCanvas.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageOrCanvas, 0, 0);
                    dataUrl = canvas.toDataURL();
                }
                this.dataManager.setBackgroundImage(dataUrl);
                this.lastLoadedBg = dataUrl; // Update tracker so we don't reload it
            } catch (e) {
                console.error("Failed to save background image to state", e);
            }
        }
    }

    draw(isExport = false) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        try {
            this.ctx.translate(this.offsetX, this.offsetY);
            this.ctx.scale(this.scale, this.scale);

            // Draw Background
            if (this.backgroundImage) {
                this.ctx.drawImage(this.backgroundImage, 0, 0);
            }

            // Draw Zones
            const zones = this.getVisibleZones();
            
            zones.forEach(zone => {
                try {
                    this.drawZone(zone, isExport);
                } catch (e) {
                    console.error("Error drawing zone:", zone.id, e);
                }
            });

            // Draw Temp Zone (while drawing rect)
            if ((this.activeTool === 'draw' || this.activeTool === 'text' || this.activeTool === 'draw-rect') && this.isDrawing && this.tempZone) {
                this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
                this.ctx.strokeStyle = '#2563EB';
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.fillRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
                this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            }

            // Draw Temp Ellipse
            if (this.activeTool === 'ellipse' && this.isDrawing && this.tempZone) {
                this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
                this.ctx.strokeStyle = '#2563EB';
                this.ctx.lineWidth = 2 / this.scale;
                
                this.ctx.beginPath();
                const cx = this.tempZone.x + this.tempZone.width / 2;
                const cy = this.tempZone.y + this.tempZone.height / 2;
                const rx = Math.abs(this.tempZone.width / 2);
                const ry = Math.abs(this.tempZone.height / 2);
                this.ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            }

            // Draw Temp Line/Arrow/Measure
            if ((this.activeTool === 'measure-length' || this.activeTool === 'arrow' || this.activeTool === 'line' || this.activeTool === 'calibrate') && this.isDrawing && this.tempZone) {
                const z = this.tempZone;
                this.ctx.beginPath();
                this.ctx.moveTo(z.x, z.y);
                this.ctx.lineTo(z.x2, z.y2);
                this.ctx.strokeStyle = '#2563EB'; 
                if (this.activeTool === 'measure-length' || this.activeTool === 'calibrate') this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.stroke();

                // Arrow Head
                if (this.activeTool === 'arrow') {
                    const angle = Math.atan2(z.y2 - z.y, z.x2 - z.x);
                    const headLen = 15 / this.scale;
                    this.ctx.beginPath();
                    this.ctx.moveTo(z.x2, z.y2);
                    this.ctx.lineTo(z.x2 - headLen * Math.cos(angle - Math.PI / 6), z.y2 - headLen * Math.sin(angle - Math.PI / 6));
                    this.ctx.lineTo(z.x2 - headLen * Math.cos(angle + Math.PI / 6), z.y2 - headLen * Math.sin(angle + Math.PI / 6));
                    this.ctx.lineTo(z.x2, z.y2);
                    this.ctx.fillStyle = '#2563EB';
                    this.ctx.fill();
                }

                // Measure Label
                if (this.activeTool === 'measure-length' || this.activeTool === 'calibrate') {
                    // Ticks
                    const angle = Math.atan2(z.y2 - z.y, z.x2 - z.x);
                    const tickSize = 10 / this.scale;
                    this.ctx.beginPath();
                    this.ctx.moveTo(z.x + tickSize * Math.cos(angle + Math.PI/2), z.y + tickSize * Math.sin(angle + Math.PI/2));
                    this.ctx.lineTo(z.x + tickSize * Math.cos(angle - Math.PI/2), z.y + tickSize * Math.sin(angle - Math.PI/2));
                    this.ctx.moveTo(z.x2 + tickSize * Math.cos(angle + Math.PI/2), z.y2 + tickSize * Math.sin(angle + Math.PI/2));
                    this.ctx.lineTo(z.x2 + tickSize * Math.cos(angle - Math.PI/2), z.y2 + tickSize * Math.sin(angle - Math.PI/2));
                    this.ctx.stroke();
                    
                    // Distance
                    const dx = z.x2 - z.x;
                    const dy = z.y2 - z.y;
                    const distPixels = Math.sqrt(dx*dx + dy*dy);
                    
                    let text = `${Math.round(distPixels)} px`;
                    if (this.activeTool === 'measure-length') {
                        const layout = this.dataManager.getActiveLayout();
                        const scale = layout.calibrationScale || 50;
                        const distMeters = distPixels / scale;
                        text = `${distMeters.toFixed(2)} m`;
                    }

                    const midX = (z.x + z.x2) / 2;
                    const midY = (z.y + z.y2) / 2;
                    this.ctx.fillStyle = '#FF0000';
                    this.ctx.strokeStyle = 'white';
                    this.ctx.lineWidth = 3;
                    this.ctx.font = `bold ${14 / this.scale}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.strokeText(text, midX, midY - 10/this.scale);
                    this.ctx.fillText(text, midX, midY - 10/this.scale);
                }
            }

            // Draw Temp Polygon/Cloud (while drawing poly)
            if ((this.activeTool === 'poly' || this.activeTool === 'cloud' || this.activeTool === 'measure-area' || this.activeTool === 'draw-poly') && this.polyPoints && this.polyPoints.length > 0) {
                this.ctx.strokeStyle = this.activeTool === 'cloud' ? '#94A3B8' : (this.activeTool === 'measure-area' ? '#FF0000' : '#2563EB');
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.beginPath();
                this.ctx.moveTo(this.polyPoints[0].x, this.polyPoints[0].y);
                for (let i = 1; i < this.polyPoints.length; i++) {
                    this.ctx.lineTo(this.polyPoints[i].x, this.polyPoints[i].y);
                }
                // Draw line to current mouse pos
                if (this.currentPos) {
                    this.ctx.lineTo(this.currentPos.x, this.currentPos.y);
                }
                this.ctx.stroke();

                // Draw points
                this.ctx.fillStyle = this.activeTool === 'cloud' ? '#94A3B8' : (this.activeTool === 'measure-area' ? '#FF0000' : '#2563EB');
                this.polyPoints.forEach(p => {
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 4 / this.scale, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            }

            // Draw Temp Symbol (while sizing)
            if (this.isSizingSymbol && this.tempZone) {
                this.drawZone(this.tempZone);
                
                // Draw dimensions
                this.ctx.fillStyle = 'black';
                this.ctx.font = `${12 / this.scale}px Inter`;
                this.ctx.fillText(`${Math.round(this.tempZone.width)}x${Math.round(this.tempZone.height)}`, this.tempZone.x, this.tempZone.y - 10 / this.scale);
                
                // Draw border to show sizing area clearly
                this.ctx.strokeStyle = '#2563EB';
                this.ctx.lineWidth = 1 / this.scale;
                this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            }
        } catch (e) {
            console.error("Critical error in draw loop:", e);
        } finally {
            this.ctx.restore();
        }
    }

    createHatchPattern(type, color, opacity) {
        // Create a small canvas for the pattern
        const patternCanvas = document.createElement('canvas');
        const size = 20; // Pattern tile size
        patternCanvas.width = size;
        patternCanvas.height = size;
        const pCtx = patternCanvas.getContext('2d');

        // Set style
        pCtx.strokeStyle = hexToRgba(color, opacity);
        pCtx.lineWidth = 2;
        pCtx.lineCap = 'square';

        switch (type) {
            case 'diagonal-right': // ///
                pCtx.beginPath();
                pCtx.moveTo(0, size);
                pCtx.lineTo(size, 0);
                // Add extra lines for seamless tiling if needed, but simple diagonal usually needs careful tiling
                // Better: Draw multiple lines to cover corners
                pCtx.moveTo(-size/2, size/2);
                pCtx.lineTo(size/2, -size/2);
                pCtx.moveTo(size/2, size + size/2);
                pCtx.lineTo(size + size/2, size/2);
                pCtx.stroke();
                break;
            case 'diagonal-left': // \\\
                pCtx.beginPath();
                pCtx.moveTo(0, 0);
                pCtx.lineTo(size, size);
                pCtx.stroke();
                break;
            case 'cross': // X
                pCtx.beginPath();
                pCtx.moveTo(0, 0);
                pCtx.lineTo(size, size);
                pCtx.moveTo(size, 0);
                pCtx.lineTo(0, size);
                pCtx.stroke();
                break;
            case 'grid': // +
                pCtx.beginPath();
                pCtx.moveTo(size/2, 0);
                pCtx.lineTo(size/2, size);
                pCtx.moveTo(0, size/2);
                pCtx.lineTo(size, size/2);
                pCtx.stroke();
                break;
            case 'horizontal': // -
                pCtx.beginPath();
                pCtx.moveTo(0, size/2);
                pCtx.lineTo(size, size/2);
                pCtx.stroke();
                break;
            case 'vertical': // |
                pCtx.beginPath();
                pCtx.moveTo(size/2, 0);
                pCtx.lineTo(size/2, size);
                pCtx.stroke();
                break;
        }

        return this.ctx.createPattern(patternCanvas, 'repeat');
    }

    drawZone(zone, isExport = false) {
        const isSelected = this.selectedZoneIds.has(zone.id);
        const state = this.dataManager.getState();
        
        // Determine scale factor for text/indicators
        // If exporting, we want a fixed readable size relative to the image width
        // Or we can use a fixed "world scale" if we assume standard plan sizes.
        // Let's try to scale based on image width if exporting.
        let renderScale = this.scale;
        if (isExport && this.backgroundImage) {
            // Heuristic: Assume a standard view fits the width of the image.
            // If the image is 4000px wide, and we want text to look like it does on a 1000px screen:
            // The "effective" scale for text sizing should be smaller.
            // Text size = BaseSize / renderScale.
            // If we use renderScale = 1 (export scale), text is BaseSize (14px). Too small.
            // We want text to be ~ 1/100 of image width?
            // 4000px / 100 = 40px.
            // So we want effective font size ~ 40px.
            // 14 / renderScale = 40 => renderScale = 14/40 = 0.35.
            // Let's try to set renderScale based on image width.
            // Standard screen width ~ 1500px.
            renderScale = 1500 / this.backgroundImage.width;
        }

        // Determine color based on view mode
        let color = zone.color; // Default fallback
        let borderColor = zone.borderColor || color;
        
        if (state.viewMode === 'discipline') {
            const discipline = state.disciplines.find(d => d.id === zone.discipline);
            if (discipline) {
                color = discipline.color;
                borderColor = discipline.color; // Discipline overrides both for consistency in view mode
            }
        } else if (state.viewMode === 'status') {
            const status = state.statuses.find(s => s.id === zone.status);
            if (status) {
                color = status.color;
                borderColor = status.color;
            }
        }

        // Handle Hidden State and Line Type
        if (zone.hidden) {
            this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
            this.ctx.globalAlpha = 0.5;
        } else {
            if (zone.lineType === 'dashed') {
                this.ctx.setLineDash([10 / this.scale, 5 / this.scale]);
            } else if (zone.lineType === 'dotted') {
                this.ctx.setLineDash([2 / this.scale, 5 / this.scale]);
            } else {
                this.ctx.setLineDash([]);
            }
            this.ctx.globalAlpha = 1.0;
        }

        // Prepare Fill Style (Solid or Pattern)
        let fillStyle;
        const opacity = zone.opacity !== undefined ? zone.opacity : 0.5;
        
        if (zone.pattern && zone.pattern !== 'none') {
            // Create pattern
            // Note: Patterns are affected by transformation matrix. 
            // If we zoom/pan, the pattern stays fixed to screen unless we transform it?
            // Actually, createPattern uses the canvas coordinate system.
            // Since we scale/translate the context, the pattern should scale/translate with it automatically?
            // Let's test. Usually patterns tile in world space if context is transformed.
            
            // However, createPattern repeats the image.
            // We need to ensure the pattern color matches the zone color.
            fillStyle = this.createHatchPattern(zone.pattern, color, opacity);
        } else {
            fillStyle = hexToRgba(color, opacity);
        }

        this.ctx.fillStyle = fillStyle;
        this.ctx.strokeStyle = isSelected ? '#F59E0B' : borderColor;
        this.ctx.lineWidth = (isSelected ? 3 : 1) / this.scale;

        if (zone.type === 'symbol') {
            const symbolDef = state.symbols.find(s => s.id === zone.symbolId);
            if (symbolDef) {
                this.ctx.save();
                // Translate to center for rotation
                const cx = zone.x + zone.width / 2;
                const cy = zone.y + zone.height / 2;
                this.ctx.translate(cx, cy);
                if (zone.rotation) {
                    this.ctx.rotate(zone.rotation * Math.PI / 180);
                }
                
                // Draw Symbol
                if (symbolDef.type === 'svg') {
                    // Check if we have a cached image for this symbol + color combination
                    if (!this.symbolCache) this.symbolCache = {};
                    
                    const cacheKey = `${symbolDef.id}_${color}_${zone.noFill ? 'outline' : 'filled'}`;

                    if (!this.symbolCache[cacheKey]) {
                        const img = new Image();
                        
                        // Fix: Ensure XML namespace exists and set dimensions for Blob rendering
                        let svgString = symbolDef.src;
                        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
                            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                        }
                        // Ensure width/height attributes exist for natural size
                        if (!svgString.includes('width=')) {
                            svgString = svgString.replace('<svg', '<svg width="100" height="100"');
                        }
                        
                        // Apply Color
                        // Replace currentColor first (common in our defaults)
                        svgString = svgString.replace(/currentColor/g, color);
                        
                        if (zone.noFill) {
                            // Outline Only Mode
                            // Remove all fills
                            svgString = svgString.replace(/fill="[^"]*"/g, 'fill="none"');
                            // Ensure we have a stroke
                            if (!svgString.includes('stroke=')) {
                                svgString = svgString.replace('<svg', `<svg stroke="${color}" stroke-width="2"`);
                            } else {
                                svgString = svgString.replace(/stroke="none"/g, `stroke="${color}"`);
                                svgString = svgString.replace(/stroke="(?!(none|transparent))[^"]*"/g, `stroke="${color}"`);
                            }
                        } else {
                            // Normal Mode
                            // Replace any specific hex/rgb fills/strokes if they are not "none"
                            svgString = svgString.replace(/fill="(?!(none|transparent))[^"]*"/g, `fill="${color}"`);
                            svgString = svgString.replace(/stroke="(?!(none|transparent))[^"]*"/g, `stroke="${color}"`);
                        }

                        const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                        const url = URL.createObjectURL(svgBlob);
                        img.src = url;
                        img.onload = () => this.draw(); // Redraw when loaded
                        img.onerror = () => console.error(`Failed to load symbol: ${symbolDef.name}`);
                        this.symbolCache[cacheKey] = img;
                    }
                    
                    const img = this.symbolCache[cacheKey];
                    if (img.complete && img.naturalWidth > 0) {
                        this.ctx.drawImage(img, -zone.width/2, -zone.height/2, zone.width, zone.height);
                    } else {
                        // Fallback while loading or if failed
                        this.ctx.strokeStyle = color;
                        this.ctx.strokeRect(-zone.width/2, -zone.height/2, zone.width, zone.height);
                        this.ctx.fillStyle = color;
                        this.ctx.fillText(symbolDef.name, 0, 0);
                    }
                } else if (symbolDef.type === 'image') {
                    if (!this.symbolCache) this.symbolCache = {};
                    if (!this.symbolCache[symbolDef.id]) {
                        const img = new Image();
                        img.src = symbolDef.src;
                        img.onload = () => this.draw();
                        img.onerror = () => console.error(`Failed to load symbol image: ${symbolDef.name}`);
                        this.symbolCache[symbolDef.id] = img;
                    }
                    const img = this.symbolCache[symbolDef.id];
                    if (img.complete && img.naturalWidth > 0) {
                        this.ctx.drawImage(img, -zone.width/2, -zone.height/2, zone.width, zone.height);
                    } else {
                         // Fallback
                        this.ctx.strokeStyle = color;
                        this.ctx.strokeRect(-zone.width/2, -zone.height/2, zone.width, zone.height);
                    }
                }
                
                this.ctx.restore();
                
                // Draw selection border if selected
                if (isSelected) {
                    this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
                }
            } else {
                // Fallback if symbol missing
                this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
                this.ctx.fillText("?", zone.x + zone.width/2, zone.y + zone.height/2);
            }
        } else if (zone.type === 'calibration-line') {
            // Draw Calibration Line (Temporary)
            this.ctx.beginPath();
            this.ctx.moveTo(zone.x, zone.y);
            this.ctx.lineTo(zone.x2, zone.y2);
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.stroke();
            
            // Draw endpoints
            this.ctx.fillStyle = '#FF0000';
            this.ctx.beginPath();
            this.ctx.arc(zone.x, zone.y, 4 / this.scale, 0, Math.PI * 2);
            this.ctx.arc(zone.x2, zone.y2, 4 / this.scale, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw label
            const dx = zone.x2 - zone.x;
            const dy = zone.y2 - zone.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const midX = (zone.x + zone.x2) / 2;
            const midY = (zone.y + zone.y2) / 2;
            
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 3;
            this.ctx.font = `${14 / this.scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.strokeText(`${Math.round(dist)} px`, midX, midY - 10/this.scale);
            this.ctx.fillText(`${Math.round(dist)} px`, midX, midY - 10/this.scale);

        } else if (zone.type === 'measure-length' || zone.type === 'arrow' || zone.type === 'line') {
            // Draw Line
            this.ctx.beginPath();
            this.ctx.moveTo(zone.x, zone.y);
            this.ctx.lineTo(zone.x2, zone.y2);
            this.ctx.strokeStyle = zone.color || '#FF0000';
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.stroke();

            // Arrow Head
            if (zone.type === 'arrow') {
                const angle = Math.atan2(zone.y2 - zone.y, zone.x2 - zone.x);
                const headLen = 15 / this.scale;
                this.ctx.beginPath();
                this.ctx.moveTo(zone.x2, zone.y2);
                this.ctx.lineTo(zone.x2 - headLen * Math.cos(angle - Math.PI / 6), zone.y2 - headLen * Math.sin(angle - Math.PI / 6));
                this.ctx.lineTo(zone.x2 - headLen * Math.cos(angle + Math.PI / 6), zone.y2 - headLen * Math.sin(angle + Math.PI / 6));
                this.ctx.lineTo(zone.x2, zone.y2);
                this.ctx.fillStyle = zone.color || '#FF0000';
                this.ctx.fill();
            }
            
            // Draw endpoints (ticks) for measure-length
            if (zone.type === 'measure-length') {
                const angle = Math.atan2(zone.y2 - zone.y, zone.x2 - zone.x);
                const tickSize = 10 / this.scale;
                
                this.ctx.beginPath();
                // Start tick
                this.ctx.moveTo(zone.x + tickSize * Math.cos(angle + Math.PI/2), zone.y + tickSize * Math.sin(angle + Math.PI/2));
                this.ctx.lineTo(zone.x + tickSize * Math.cos(angle - Math.PI/2), zone.y + tickSize * Math.sin(angle - Math.PI/2));
                // End tick
                this.ctx.moveTo(zone.x2 + tickSize * Math.cos(angle + Math.PI/2), zone.y2 + tickSize * Math.sin(angle + Math.PI/2));
                this.ctx.lineTo(zone.x2 + tickSize * Math.cos(angle - Math.PI/2), zone.y2 + tickSize * Math.sin(angle - Math.PI/2));
                this.ctx.stroke();

                // Calculate real distance
                const dx = zone.x2 - zone.x;
                const dy = zone.y2 - zone.y;
                const distPixels = Math.sqrt(dx*dx + dy*dy);
                
                const layout = this.dataManager.getActiveLayout();
                const scale = layout.calibrationScale || 50; // Default 50px/m
                const distMeters = distPixels / scale;
                
                // Draw label
                const midX = (zone.x + zone.x2) / 2;
                const midY = (zone.y + zone.y2) / 2;
                
                this.ctx.fillStyle = zone.color || '#FF0000';
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 3;
                this.ctx.font = `bold ${14 / this.scale}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.strokeText(`${distMeters.toFixed(2)} m`, midX, midY - 10/this.scale);
                this.ctx.fillText(`${distMeters.toFixed(2)} m`, midX, midY - 10/this.scale);
            }
            
            if (isSelected) {
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 1 / this.scale;
                this.ctx.strokeRect(zone.x - 5/this.scale, zone.y - 5/this.scale, 10/this.scale, 10/this.scale);
                this.ctx.strokeRect(zone.x2 - 5/this.scale, zone.y2 - 5/this.scale, 10/this.scale, 10/this.scale);
            }

        } else if (zone.type === 'ellipse') {
            this.ctx.beginPath();
            const cx = zone.x + zone.width / 2;
            const cy = zone.y + zone.height / 2;
            const rx = zone.width / 2;
            const ry = zone.height / 2;
            this.ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            if (!zone.noFill) {
                this.ctx.fill();
            }
            this.ctx.stroke();
            
            if (isSelected) {
                this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
            }

        } else if (zone.type === 'text') {
            const fontSize = (zone.customData && zone.customData.fontSize) || 16;
            // Use world-space font size so it scales with zoom, keeping bounding box valid
            this.ctx.font = `${fontSize}px Arial`;
            this.ctx.fillStyle = zone.color || '#000000';
            
            // Center text in bounding box
            this.ctx.textBaseline = 'middle';
            this.ctx.textAlign = 'center';
            const cx = zone.x + zone.width / 2;
            const cy = zone.y + zone.height / 2;
            
            // Handle multi-line text if needed (simple split by newline)
            const lines = (zone.name || '').split('\n');
            if (lines.length > 1) {
                const lineHeight = fontSize * 1.2;
                const totalHeight = lines.length * lineHeight;
                let startY = cy - totalHeight / 2 + lineHeight / 2;
                
                lines.forEach((line, i) => {
                    this.ctx.fillText(line, cx, startY + i * lineHeight);
                });
            } else {
                this.ctx.fillText(zone.name, cx, cy);
            }
            
            // Reset alignment
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
            
            if (isSelected) {
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 1 / this.scale;
                this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
            }

        } else if (zone.type === 'polygon' || zone.type === 'cloud' || zone.type === 'measure-area' || zone.type === 'draw-poly') {
            this.ctx.beginPath();
            if (zone.points && zone.points.length > 0) {
                if (zone.type === 'cloud') {
                    // Draw Cloud Arcs
                    const points = zone.points;
                    this.ctx.moveTo(points[0].x, points[0].y);
                    
                    for (let i = 0; i < points.length; i++) {
                        const p1 = points[i];
                        const p2 = points[(i + 1) % points.length];
                        
                        // Calculate distance and midpoint
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        
                        // Number of bumps based on distance
                        const bumpSize = 20 / this.scale;
                        const bumps = Math.max(1, Math.round(dist / bumpSize));
                        
                        for (let j = 1; j <= bumps; j++) {
                            const t = j / bumps;
                            const prevT = (j - 1) / bumps;
                            
                            const startX = p1.x + dx * prevT;
                            const startY = p1.y + dy * prevT;
                            const endX = p1.x + dx * t;
                            const endY = p1.y + dy * t;
                            
                            // Control point for arc (perpendicular to line)
                            const midX = (startX + endX) / 2;
                            const midY = (startY + endY) / 2;
                            
                            // Perpendicular vector (-dy, dx)
                            const perpX = -dy / dist * bumpSize * 0.5;
                            const perpY = dx / dist * bumpSize * 0.5;
                            
                            const cpX = midX + perpX;
                            const cpY = midY + perpY;
                            
                            this.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
                        }
                    }
                    this.ctx.closePath();
                } else {
                    // Standard Polygon
                    this.ctx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        this.ctx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                    if (zone.type !== 'draw-poly') {
                        this.ctx.closePath();
                    }
                }
            }
            if (!zone.noFill && zone.type !== 'draw-poly') {
                this.ctx.fill();
            }
            this.ctx.stroke();

            if (zone.type === 'measure-area' && zone.points && zone.points.length > 2) {
                // Calculate Area
                let area = 0;
                for (let i = 0; i < zone.points.length; i++) {
                    const p1 = zone.points[i];
                    const p2 = zone.points[(i + 1) % zone.points.length];
                    area += (p1.x * p2.y - p2.x * p1.y);
                }
                area = Math.abs(area / 2);
                
                const layout = this.dataManager.getActiveLayout();
                const scale = layout.calibrationScale || 50;
                const areaMeters = area / (scale * scale);
                
                // Draw Label
                // Calculate centroid
                let cx = 0, cy = 0;
                for (let p of zone.points) {
                    cx += p.x;
                    cy += p.y;
                }
                cx /= zone.points.length;
                cy /= zone.points.length;
                
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 3 / this.scale;
                this.ctx.font = `bold ${14 / this.scale}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                const text = `${areaMeters.toFixed(2)} m²`;
                this.ctx.strokeText(text, cx, cy);
                this.ctx.fillText(text, cx, cy);
            }
        } else {
            if (!zone.noFill) {
                this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
            }
            this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        }

        // Reset styles for overlays (Label, Indicators, Handles)
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;

        // Draw Label (Skip for symbols unless they have a name override?)
        if (zone.type !== 'symbol' && zone.type !== 'cloud' && zone.type !== 'measure-area' && zone.type !== 'measure-length' && zone.type !== 'calibration-line' && zone.type !== 'text' && zone.type !== 'arrow' && zone.type !== 'line' && zone.type !== 'draw-poly' && zone.type !== 'draw-rect') {
            
            // 13. Smart Label Rendering (Hide for tiny objects, move outside for small ones)
            // minDim is still calculated relative to screen to hide text when it becomes visually too small
            const minDim = 10 / renderScale;
            if (zone.width < minDim || zone.height < minDim) {
                // Too small, skip text
            } else {
                
                // Determine Text Color
                let textColor = 'white';
                if (zone.autoTextColor !== false) { 
                    if (zone.noFill) {
                        textColor = 'white'; // White with shadow is safest for outlines over maps
                    } else {
                        textColor = getContrastColor(color);
                    }
                } else {
                    textColor = zone.textColor || 'white';
                }

                this.ctx.fillStyle = textColor;
                
                // Use Global Font Size Setting (Default 14) unless overridden by zone specific
                const globalFontSize = this.dataManager.getState().projectSettings?.baseFontSize || 14;
                const baseFontSize = zone.customData && zone.customData.fontSize ? zone.customData.fontSize : globalFontSize;
                
                // FIXED SCALING: Use World Units directly so text scales with the drawing
                const mainFontSize = baseFontSize;
                const dateFontSize = baseFontSize * 0.7; 
                
                this.ctx.font = `${mainFontSize}px Inter`;
                
                // Shadow for visibility
                if (textColor === 'white' || textColor === '#ffffff' || textColor === '#FFFFFF') {
                    this.ctx.shadowColor = "rgba(0,0,0,0.5)";
                    this.ctx.shadowBlur = 4;
                } else {
                    this.ctx.shadowColor = "rgba(255,255,255,0.5)";
                    this.ctx.shadowBlur = 4;
                }
                
                // Prepare date string
                let dateStr = '';
                if (zone.startDate || zone.endDate || zone.date) {
                    if (zone.startDate && zone.endDate) {
                        dateStr = `${getWeekDayString(zone.startDate)} - ${getWeekDayString(zone.endDate)}`;
                    } else if (zone.startDate) {
                        dateStr = getWeekDayString(zone.startDate);
                    } else if (zone.date) {
                        dateStr = getWeekDayString(zone.date);
                    }
                }

                // Measure Text & Strategy
                const metrics = this.ctx.measureText(zone.name);
                const textWidth = metrics.width;
                const padding = 5; // World units
                const availableWidth = zone.width - (padding * 2);
                
                let drawOutside = false;
                
                // Logic: If text doesn't fit horizontally OR vertical space is too tight OR zone is generally small
                // Scaled thresholds to adjust automatically
                // We use world units now, so comparison is direct
                const smallZoneThreshold = 40; // 40 world units
                const totalTextHeight = dateStr ? (mainFontSize + dateFontSize + padding) : mainFontSize;
                
                if (textWidth > availableWidth || zone.width < smallZoneThreshold || zone.height < totalTextHeight) {
                    drawOutside = true;
                }

                let labelX, labelY;

                if (drawOutside) {
                    // --- CALLOUT STYLE (Outside) ---
                    // Fixed visual sizes relative to world now? 
                    // If we want the *callout box* to scale with drawing, use simple numbers.
                    // If we want callout box to be fixed screen size, we'd need / renderScale.
                    // User asked for "fixed according to settings", usually implies World Scale for text.
                    // So we scale everything in World Units.

                    const lineLen = 15;
                    const rightX = zone.x + zone.width;
                    const midY = zone.y + (zone.height / 2);
                    
                    // Leader Line
                    this.ctx.beginPath();
                    this.ctx.moveTo(rightX, midY);
                    this.ctx.lineTo(rightX + lineLen, midY);
                    this.ctx.strokeStyle = '#333'; 
                    this.ctx.lineWidth = 1 / renderScale; // Keep hairline stroke
                    this.ctx.stroke();

                    // Text Position (Right of the line)
                    labelX = rightX + lineLen + 5;
                    labelY = midY; 
                    
                    this.ctx.textAlign = 'left';
                    this.ctx.textBaseline = 'middle'; 

                    // --- DRAW BACKGROUND BOX ---
                    const paddingBox = 4;
                    const maxTextW = Math.max(textWidth, dateStr ? this.ctx.measureText(dateStr).width : 0);
                    const totalW = maxTextW + (paddingBox * 2);
                    const totalH = totalTextHeight + (paddingBox * 2);

                    const boxX = labelX - paddingBox;
                    const boxY = midY - (totalH / 2);

                    // Drop Shadow for Box
                    this.ctx.shadowColor = "rgba(0,0,0,0.15)";
                    this.ctx.shadowBlur = 6;
                    this.ctx.shadowOffsetX = 2;
                    this.ctx.shadowOffsetY = 2;

                    // Message Box Background
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                    this.ctx.beginPath();
                    // Rounded Rect
                    const r = 4;
                    this.ctx.moveTo(boxX + r, boxY);
                    this.ctx.lineTo(boxX + totalW - r, boxY);
                    this.ctx.quadraticCurveTo(boxX + totalW, boxY, boxX + totalW, boxY + r);
                    this.ctx.lineTo(boxX + totalW, boxY + totalH - r);
                    this.ctx.quadraticCurveTo(boxX + totalW, boxY + totalH, boxX + totalW - r, boxY + totalH);
                    this.ctx.lineTo(boxX + r, boxY + totalH);
                    this.ctx.quadraticCurveTo(boxX, boxY + totalH, boxX, boxY + totalH - r);
                    this.ctx.lineTo(boxX, boxY + r);
                    this.ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
                    this.ctx.fill();
                    
                    // Border (Stroke) for Box - Optional
                    this.ctx.shadowColor = "transparent"; 
                    this.ctx.strokeStyle = '#cbd5e1'; 
                    this.ctx.lineWidth = 0.5 / renderScale; // Hairline border
                    this.ctx.stroke();

                    // --- DRAW TEXT ---
                    this.ctx.fillStyle = '#0f172a'; 
                    this.ctx.shadowBlur = 0; 

                    if (dateStr) {
                         // Center the group of text vertically around the line
                         this.ctx.fillText(zone.name, labelX, labelY - 6);
                         
                         this.ctx.fillStyle = '#64748b'; 
                         this.ctx.font = `${dateFontSize}px Inter`;
                         this.ctx.fillText(dateStr, labelX, labelY + 6);
                    } else {
                        this.ctx.fillText(zone.name, labelX, labelY);
                    }

                } else {
                    // --- INTERNAL LABEL (Standard) ---
                    if (zone.type === 'polygon') {
                        labelX = zone.x + zone.width / 2;
                        labelY = zone.y + zone.height / 2;
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        
                        if (dateStr) {
                            this.ctx.fillText(zone.name, labelX, labelY - 7);
                            this.ctx.font = `${dateFontSize}px Inter`;
                            this.ctx.fillText(dateStr, labelX, labelY + 7);
                        } else {
                            this.ctx.fillText(zone.name, labelX, labelY);
                        }
                    } else {
                        labelX = zone.x + 5;
                        labelY = zone.y + 20;
                        this.ctx.textAlign = 'left';
                        this.ctx.textBaseline = 'alphabetic';
                        
                        this.ctx.fillText(zone.name, labelX, labelY);
                        
                        if (dateStr) {
                            this.ctx.font = `${dateFontSize}px Inter`;
                            this.ctx.fillText(dateStr, labelX, labelY + 12);
                        }
                    }
                }
                
                // Reset text align & shadow
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'alphabetic';
                this.ctx.shadowBlur = 0;
            }
        }

        // Draw Connected Indicator (Checkmark)
        const hasLegacy = zone.customData && zone.customData._activityCode;
        const hasMulti = zone.customData && zone.customData._connectedActivities && zone.customData._connectedActivities.length > 0;
        
        if (hasLegacy || hasMulti) {
            this.drawConnectionIndicator(zone, renderScale);
        }

        // Draw Resize Handles if selected
        if (isSelected) {
            this.drawResizeHandles(zone);
        }
    }

    drawConnectionIndicator(zone, renderScale = null) {
        const scale = renderScale || this.scale;
        const size = 16 / scale;
        const padding = 4 / scale;
        const x = zone.x + zone.width - size - padding;
        const y = zone.y + padding;

        // Circle background
        this.ctx.beginPath();
        this.ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#10B981'; // Success green
        this.ctx.fill();
        
        // Checkmark
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.25, y + size * 0.5);
        this.ctx.lineTo(x + size * 0.45, y + size * 0.7);
        this.ctx.lineTo(x + size * 0.75, y + size * 0.3);
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2 / scale;
        this.ctx.stroke();
    }

    drawResizeHandles(zone) {
        const handleSize = 8 / this.scale;
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 1 / this.scale;

        let coords = [];
        if (zone.type === 'polygon' || zone.type === 'cloud' || zone.type === 'measure-area' || zone.type === 'draw-poly') {
            coords = zone.points;
        } else {
            coords = [
                { x: zone.x, y: zone.y }, // TL
                { x: zone.x + zone.width, y: zone.y }, // TR
                { x: zone.x, y: zone.y + zone.height }, // BL
                { x: zone.x + zone.width, y: zone.y + zone.height } // BR
            ];
        }

        coords.forEach(c => {
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });

        // Draw "+" handles for draw-poly
        if (zone.type === 'draw-poly' && zone.points.length > 1) {
            const drawPlus = (x, y) => {
                const size = 12 / this.scale;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
                this.ctx.fillStyle = '#2563EB';
                this.ctx.fill();
                
                this.ctx.beginPath();
                this.ctx.moveTo(x - size/4, y);
                this.ctx.lineTo(x + size/4, y);
                this.ctx.moveTo(x, y - size/4);
                this.ctx.lineTo(x, y + size/4);
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.stroke();
            };

            // Start Handle
            const p0 = zone.points[0];
            const p1 = zone.points[1];
            const dx = p0.x - p1.x;
            const dy = p0.y - p1.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            const offset = 20 / this.scale;
            drawPlus(p0.x + (dx/len) * offset, p0.y + (dy/len) * offset);

            // End Handle
            const pn = zone.points[zone.points.length - 1];
            const pn1 = zone.points[zone.points.length - 2];
            const dx2 = pn.x - pn1.x;
            const dy2 = pn.y - pn1.y;
            const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
            drawPlus(pn.x + (dx2/len2) * offset, pn.y + (dy2/len2) * offset);

            // Draw "-" handles for draw-poly
            const drawMinus = (x, y) => {
                const size = 12 / this.scale;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
                this.ctx.fillStyle = '#EF4444'; // Red
                this.ctx.fill();
                
                this.ctx.beginPath();
                this.ctx.moveTo(x - size/4, y);
                this.ctx.lineTo(x + size/4, y);
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.stroke();
            };

            const offsetMinus = 35 / this.scale;
            drawMinus(p0.x + (dx/len) * offsetMinus, p0.y + (dy/len) * offsetMinus);
            drawMinus(pn.x + (dx2/len2) * offsetMinus, pn.y + (dy2/len2) * offsetMinus);
        }

        // Rotation Handle for Symbols
        if (zone.type === 'symbol') {
            const cx = zone.x + zone.width / 2;
            const cy = zone.y;
            const handleY = cy - 20 / this.scale;
            
            // Line to handle
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx, handleY);
            this.ctx.stroke();
            
            // Handle circle
            this.ctx.beginPath();
            this.ctx.arc(cx, handleY, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fillStyle = '#F59E0B'; // Different color for rotation
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    // --- Text Editing ---

    startEditingText(zone) {
        // Remove existing editor if any
        const existing = document.getElementById('text-editor-overlay');
        if (existing) existing.remove();

        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.id = 'text-editor-overlay';
        textarea.value = zone.name;
        
        // Calculate screen position
        const rect = this.canvas.getBoundingClientRect();
        const screenX = rect.left + this.offsetX + zone.x * this.scale;
        const screenY = rect.top + this.offsetY + zone.y * this.scale;
        const screenW = zone.width * this.scale;
        const screenH = zone.height * this.scale;
        
        const fontSize = (zone.customData && zone.customData.fontSize) || 16;
        const screenFontSize = fontSize * this.scale; // Scale font size to screen

        // Style
        textarea.style.position = 'absolute';
        textarea.style.left = `${screenX}px`;
        textarea.style.top = `${screenY}px`;
        textarea.style.width = `${screenW}px`;
        textarea.style.height = `${screenH}px`;
        textarea.style.fontSize = `${screenFontSize}px`;
        textarea.style.fontFamily = 'Arial';
        textarea.style.color = zone.color || '#000000';
        textarea.style.background = 'rgba(255, 255, 255, 0.8)';
        textarea.style.border = '1px dashed #2563EB';
        textarea.style.padding = '0';
        textarea.style.margin = '0';
        textarea.style.outline = 'none';
        textarea.style.resize = 'none';
        textarea.style.textAlign = 'center'; // Match canvas rendering
        textarea.style.lineHeight = '1.2';
        textarea.style.zIndex = '1000';
        
        // Center vertically using flexbox-like padding or just simple calculation
        // Textarea doesn't support vertical-align: middle easily without flex wrapper.
        // For simplicity, we let user type. If we want perfect match, we need more complex CSS.
        // Let's try to match the padding to center it if it's single line?
        // Actually, standard textarea behavior (top-left) is usually expected for editing.
        // But user asked for "centralized".
        // Let's keep it simple: Textarea fills the box.
        
        document.body.appendChild(textarea);
        textarea.focus();

        // Save on blur
        const save = () => {
            const newText = textarea.value;
            this.dataManager.updateZone({
                ...zone,
                name: newText
            });
            textarea.remove();
            this.draw();
        };

        textarea.addEventListener('blur', save);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent newline if just Enter
                textarea.blur();
            }
        });
    }

    // --- Drag & Drop (Excel Mapping) ---

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        // Highlight zone under mouse
        const pos = this.getMousePos(e);
        const hovered = this.getZoneAt(pos);
        
        if (hovered?.id !== this.hoveredZoneId) {
            this.hoveredZoneId = hovered?.id || null;
            this.draw();
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        try {
            const jsonStr = e.dataTransfer.getData('application/json');
            if (!jsonStr) return;
            
            const data = JSON.parse(jsonStr);

            // Handle Symbol Drop
            if (data.type === 'symbol') {
                const symbolDef = this.dataManager.getState().symbols.find(s => s.id === data.symbolId);
                if (!symbolDef) return;

                // Start Sizing Mode
                this.isSizingSymbol = true;
                this.startPos = pos;
                this.tempZone = {
                    id: 'temp-symbol',
                    x: pos.x,
                    y: pos.y,
                    width: 1, // Start small
                    height: 1,
                    type: 'symbol',
                    symbolId: data.symbolId,
                    rotation: 0,
                    name: symbolDef.name,
                    discipline: '',
                    status: 'planned',
                    comments: '',
                    customData: {},
                    color: '#000000',
                    opacity: 0.7,
                    hidden: false
                };
                this.draw();
                return;
            }

            // Handle Excel Data Drop (existing logic)
            const zone = this.getZoneAt(pos);
            if (zone) {
                // Map Excel data to Zone
                let connectedActivities = zone.customData._connectedActivities || [];
                
                // Migration: Check for legacy single activity
                if (zone.customData._activityCode && !connectedActivities.some(a => a.code === zone.customData._activityCode)) {
                    connectedActivities.push({
                        code: zone.customData._activityCode,
                        start: zone.customData._startDate,
                        end: zone.customData._endDate,
                        title: zone.customData.name || 'Unknown' // Legacy might not have title stored separately
                    });
                }

                // Check for duplicates
                if (!connectedActivities.some(a => a.code === data.code)) {
                    connectedActivities.push({
                        code: data.code,
                        start: data.start,
                        end: data.end,
                        title: data.title
                    });
                }

                // Calculate new zone range based on all connected activities
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

                const updates = {
                    startDate: minStart,
                    endDate: maxEnd,
                    customData: {
                        ...zone.customData,
                        ...data.originalData, // Store raw excel data (maybe just from the last one?)
                        _connectedActivities: connectedActivities
                    }
                };

                // Check naming mode
                const nameMode = this.dataManager.getState().zoneNameMode || 'activity';
                if (nameMode === 'activity') {
                    // If multiple activities, maybe use the latest one or a combination?
                    // For now, let's use the latest dropped activity title as the zone name
                    // if the user wants "Activity Name" mode.
                    updates.name = data.title;
                }
                
                // Remove legacy fields
                delete updates.customData._activityCode;
                delete updates.customData._startDate;
                delete updates.customData._endDate;

                // Update status based on dates (simple logic)
                // Could be expanded later
                
                this.dataManager.updateZone({ ...zone, ...updates });
                this.uiManager.selectZone(zone.id); // Refresh UI
                
                // Visual feedback
                alert(this.uiManager.t('connectedToZone', { title: data.title }));
            }
        } catch (err) {
            console.error("Failed to parse dropped data", err);
        }
    }

    getVisibleZones() {
        const activeLayout = this.dataManager.getActiveLayout();
        if (!activeLayout) return [];
        
        const zones = activeLayout.zones || [];
        const filters = this.dataManager.getState().filters;
        
        if (!filters) return zones;

        return zones.filter(zone => {
            // Hidden Filter
            if (zone.hidden && !filters.showHidden) {
                return false;
            }

            // Text Filter (Name, ID, Comments, Custom Fields)
            if (filters.text) {
                const search = filters.text.toLowerCase();
                const matchName = (zone.name || '').toLowerCase().includes(search);
                const matchId = (zone.id || '').toLowerCase().includes(search); // Usually UUID, maybe not useful
                const matchComments = (zone.comments || '').toLowerCase().includes(search);
                const matchContact = (zone.contact || '').toLowerCase().includes(search);
                const matchFreetext = (zone.freetext || '').toLowerCase().includes(search);
                
                // Check custom data
                let matchCustom = false;
                if (zone.customData) {
                    matchCustom = Object.values(zone.customData).some(val => 
                        String(val).toLowerCase().includes(search)
                    );
                }

                if (!matchName && !matchComments && !matchContact && !matchFreetext && !matchCustom) return false;
            }

            // Discipline Filter
            if (filters.disciplines && filters.disciplines.length > 0) {
                if (!filters.disciplines.includes(zone.discipline)) return false;
            }

            // Status Filter
            if (filters.statuses && filters.statuses.length > 0) {
                if (!filters.statuses.includes(zone.status)) return false;
            }

            // Date Filter
            if (filters.dateStart || filters.dateEnd) {
                const zStart = zone.startDate || zone.date;
                const zEnd = zone.endDate || zone.date;
                
                if (!zStart && !zEnd) return false; 

                if (filters.dateStart) {
                    // If zone ends before filter start, hide it
                    if (zEnd && zEnd < filters.dateStart) return false;
                    if (!zEnd && zStart < filters.dateStart) return false;
                }
                if (filters.dateEnd) {
                    // If zone starts after filter end, hide it
                    if (zStart && zStart > filters.dateEnd) return false;
                }
            }

            // Week Filter
            if ((filters.weeks && filters.weeks.length > 0) || filters.week) {
                const zStart = zone.startDate || zone.date;
                const zEnd = zone.endDate || zone.date;
                
                if (!zStart && !zEnd) return false; 

                const startWeek = zStart ? getWeekNumber(new Date(zStart)) : null;
                const endWeek = zEnd ? getWeekNumber(new Date(zEnd)) : startWeek;
                
                const s = startWeek || endWeek;
                const e = endWeek || startWeek;
                
                if (!s) return false;

                if (filters.weeks && filters.weeks.length > 0) {
                    let match = false;
                    const zMin = Math.min(s, e);
                    const zMax = Math.max(s, e);
                    
                    for (const w of filters.weeks) {
                        const weekNum = parseInt(w, 10);
                        if (weekNum >= zMin && weekNum <= zMax) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) return false;
                } else if (filters.week) {
                    const filterInput = String(filters.week).trim();
                    if (filterInput.includes('-')) {
                        const [fStart, fEnd] = filterInput.split('-').map(str => parseInt(str.trim(), 10));
                        if (!isNaN(fStart) && !isNaN(fEnd)) {
                            const zMin = Math.min(s, e);
                            const zMax = Math.max(s, e);
                            if (!(zMin <= fEnd && fStart <= zMax)) return false;
                        }
                    } else {
                        const targetW = parseInt(filterInput, 10);
                        if (!isNaN(targetW)) {
                             const zMin = Math.min(s, e);
                             const zMax = Math.max(s, e);
                             if (targetW < zMin || targetW > zMax) return false;
                        }
                    }
                }
            }

            return true;
        });
    }

    handleStateChange(state) {
        // Redraw when state changes (e.g. filters, zones, etc.)
        this.draw();
        this.updateDateRangeDisplay();
    }

    updateDateRangeDisplay() {
        const visibleZones = this.getVisibleZones();
        let minDate = null;
        let maxDate = null;

        visibleZones.forEach(zone => {
            // Check startDate/endDate
            if (zone.startDate) {
                if (!minDate || zone.startDate < minDate) minDate = zone.startDate;
                if (!maxDate || zone.startDate > maxDate) maxDate = zone.startDate;
            }
            if (zone.endDate) {
                if (!minDate || zone.endDate < minDate) minDate = zone.endDate;
                if (!maxDate || zone.endDate > maxDate) maxDate = zone.endDate;
            }
            // Fallback to legacy date
            if (zone.date) {
                if (!minDate || zone.date < minDate) minDate = zone.date;
                if (!maxDate || zone.date > maxDate) maxDate = zone.date;
            }
        });

        const displayEl = document.getElementById('date-range-display');
        const textEl = document.getElementById('date-range-text');

        if (minDate && maxDate) {
            const startStr = getWeekDayString(minDate);
            const endStr = getWeekDayString(maxDate);
            
            if (startStr && endStr) {
                textEl.textContent = `${startStr} - ${endStr}`;
                displayEl.classList.remove('hidden');
            } else {
                displayEl.classList.add('hidden');
            }
        } else if (minDate) {
             const startStr = getWeekDayString(minDate);
             textEl.textContent = `${startStr}`;
             displayEl.classList.remove('hidden');
        } else {
            displayEl.classList.add('hidden');
        }
    }

    exportPdf(quality = 0.8, filename = 'Zone_Planner-export') {
        if (!this.backgroundImage) {
            alert(this.uiManager.t('uploadLayoutPrompt'));
            return;
        }

        // Save current state
        const savedCtx = this.ctx;
        const savedScale = this.scale;
        const savedOffsetX = this.offsetX;
        const savedOffsetY = this.offsetY;
        const savedCanvas = this.canvas;

        const performExport = async () => {
             try {
                const { jsPDF } = window.jspdf;
                
                // Create a temporary canvas with the full size of the background
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.backgroundImage.width;
                tempCanvas.height = this.backgroundImage.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Swap to temp context and full scale
                this.ctx = tempCtx;
                this.canvas = tempCanvas;
                this.scale = 1;
                this.offsetX = 0;
                this.offsetY = 0;
                
                // Draw everything
                // Pass a flag to indicate export mode, so we can adjust font sizes
                this.draw(true);

                // Draw Legend (Top Left)
                this.drawLegend(tempCtx);

                // Draw Week Filter (Top Right)
                this.drawWeekFilter(tempCtx);
                
                // Generate PDF
                const imgData = tempCanvas.toDataURL('image/jpeg', quality);
                const orientation = tempCanvas.width > tempCanvas.height ? 'l' : 'p';
                
                const doc = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [tempCanvas.width, tempCanvas.height]
                });
                
                doc.addImage(imgData, 'JPEG', 0, 0, tempCanvas.width, tempCanvas.height);

                // Ensure filename ends with .pdf
                if (!filename.toLowerCase().endsWith('.pdf')) {
                    filename += '.pdf';
                }

                // Try File System Access API first
                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: 'PDF Document',
                                accept: {'application/pdf': ['.pdf']},
                            }],
                        });
                        const writable = await handle.createWritable();
                        const pdfBlob = doc.output('blob');
                        await writable.write(pdfBlob);
                        await writable.close();
                        return; // Success
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error("File System Access API failed, falling back to download", err);
                        } else {
                            // User cancelled, do nothing
                            return; 
                        }
                    }
                }
                
                doc.save(filename);
                
            } catch (e) {
                console.error("PDF Export failed:", e);
                alert("PDF Export failed. See console for details.");
            } finally {
                // Restore state
                this.ctx = savedCtx;
                this.canvas = savedCanvas;
                this.scale = savedScale;
                this.offsetX = savedOffsetX;
                this.offsetY = savedOffsetY;
                this.draw();
            }
        };

        performExport();
    }

    drawWeekFilter(ctx) {
        if (!this.uiManager.elements.dateRangeText) return;
        
        const text = this.uiManager.elements.dateRangeText.textContent;
        // Don't draw if default or empty
        if (!text || text === '--') return;

        const padding = 20;
        const fontSize = 24;
        
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(text).width;
        
        // Approximate icon width since we can't easily draw the material icon on canvas without loading it as image
        // We'll just draw the text clearly.
        const width = textWidth + padding * 2;
        const height = fontSize + padding * 2;
        
        // Position Top Right
        // 20px from right edge
        const x = this.canvas.width - width - 20; 
        const y = 20; // Top aligned with legend

        // Draw Background
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height); // Add border
        ctx.restore();

        // Draw Text
        ctx.fillStyle = '#1E293B'; // --text-main
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + width/2, y + height/2);
    }

    drawLegend(ctx) {
        const state = this.dataManager.getState();
        const padding = 20;
        const lineHeight = 30;
        const boxSize = 20;
        const fontSize = 24;
        
        let items = [];
        let title = "";

        if (state.viewMode === 'discipline') {
            title = "Discipliner";
            items = state.disciplines;
        } else {
            title = "Status";
            items = state.statuses;
        }

        if (items.length === 0) return;

        // Calculate dimensions
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const titleWidth = ctx.measureText(title).width;
        
        ctx.font = `${fontSize}px Inter, sans-serif`;
        let maxWidth = titleWidth;
        items.forEach(item => {
            const w = ctx.measureText(this.uiManager.t(item.name)).width;
            if (w + boxSize + 10 > maxWidth) maxWidth = w + boxSize + 10;
        });

        const width = maxWidth + padding * 2;
        const height = (items.length + 1) * lineHeight + padding * 2;
        const x = 20;
        const y = 20;

        // Draw Background
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.fillRect(x, y, width, height);
        ctx.restore();

        // Draw Title
        ctx.fillStyle = '#000';
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(title, x + padding, y + padding);

        // Draw Items
        ctx.font = `${fontSize}px Inter, sans-serif`;
        items.forEach((item, index) => {
            const itemY = y + padding + (index + 1) * lineHeight;
            
            // Color Box
            ctx.fillStyle = item.color;
            ctx.fillRect(x + padding, itemY + (lineHeight - boxSize)/2, boxSize, boxSize);
            ctx.strokeRect(x + padding, itemY + (lineHeight - boxSize)/2, boxSize, boxSize);

            // Text
            ctx.fillStyle = '#000';
            ctx.fillText(this.uiManager.t(item.name), x + padding + boxSize + 10, itemY + 5);
        });
    }

}
