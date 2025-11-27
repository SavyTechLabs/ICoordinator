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
                this.lastLoadedBg = currentBg;
                const img = new Image();
                img.onload = () => {
                    this.setBackground(img, false);
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

        this.startPos = pos;

        if (this.activeTool === 'draw') {
            this.isDrawing = true;
            // Create a temporary zone
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                type: 'rect'
            };
        } else if (this.activeTool === 'poly' || this.activeTool === 'cloud') {
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
                    return;
                }
                
                if (this.resizeHandle !== null) {
                    this.isResizing = true;
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
        const pos = this.getMousePos(e);
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

        if (this.activeTool === 'draw' && this.isDrawing) {
            this.tempZone.width = pos.x - this.startPos.x;
            this.tempZone.height = pos.y - this.startPos.y;
            this.draw();
        } else if ((this.activeTool === 'poly' || this.activeTool === 'cloud') && this.isDrawing) {
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
            });
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
                this.dataManager.updateZone(updatedZone);
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
        if (this.activeTool === 'draw' && this.isDrawing) {
            this.isDrawing = false;
            // Normalize zone (negative width/height)
            const zone = {
                id: generateUUID(),
                x: Math.min(this.startPos.x, this.currentPos.x),
                y: Math.min(this.startPos.y, this.currentPos.y),
                width: Math.abs(this.tempZone.width),
                height: Math.abs(this.tempZone.height),
                type: 'rect',
                color: '#2563EB', // Default color
                opacity: 0.5,
                name: this.uiManager.t('newZone'),
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
            if (z.type === 'polygon' || z.type === 'cloud') {
                if (this.isPointInPolygon(pos, z.points)) {
                    return z;
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

        if (zone.type === 'polygon' || zone.type === 'cloud') {
            // Check each vertex
            for (let i = 0; i < zone.points.length; i++) {
                const p = zone.points[i];
                if (Math.abs(pos.x - p.x) < handleSize && Math.abs(pos.y - p.y) < handleSize) {
                    return i; // Return index of vertex
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
        if (zone.type === 'polygon' || zone.type === 'cloud') {
            // Move vertex
            const index = this.resizeHandle;
            if (index !== null && index >= 0 && index < zone.points.length) {
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
                });
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
                });
            }
        }
    }

    finishPolygon() {
        this.isDrawing = false;
        const zone = {
            id: generateUUID(),
            type: this.activeTool === 'cloud' ? 'cloud' : 'polygon',
            points: [...this.polyPoints],
            // Calculate bounding box for simple checks
            x: Math.min(...this.polyPoints.map(p => p.x)),
            y: Math.min(...this.polyPoints.map(p => p.y)),
            width: Math.max(...this.polyPoints.map(p => p.x)) - Math.min(...this.polyPoints.map(p => p.x)),
            height: Math.max(...this.polyPoints.map(p => p.y)) - Math.min(...this.polyPoints.map(p => p.y)),
            color: this.activeTool === 'cloud' ? '#94A3B8' : '#2563EB',
            opacity: 0.5,
            name: this.activeTool === 'cloud' ? this.uiManager.t('cloud') : this.uiManager.t('newPolygon'),
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
            if (this.activeTool === 'draw' && this.isDrawing && this.tempZone) {
                this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
                this.ctx.strokeStyle = '#2563EB';
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.fillRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
                this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            }

            // Draw Temp Polygon/Cloud (while drawing poly)
            if ((this.activeTool === 'poly' || this.activeTool === 'cloud') && this.polyPoints && this.polyPoints.length > 0) {
                this.ctx.strokeStyle = this.activeTool === 'cloud' ? '#94A3B8' : '#2563EB';
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
                this.ctx.fillStyle = this.activeTool === 'cloud' ? '#94A3B8' : '#2563EB';
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

        // Handle Hidden State
        if (zone.hidden) {
            this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
            this.ctx.globalAlpha = 0.5;
        } else {
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.fillStyle = hexToRgba(color, zone.opacity !== undefined ? zone.opacity : 0.5);
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
        } else if (zone.type === 'polygon' || zone.type === 'cloud') {
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
                    this.ctx.closePath();
                }
            }
            if (!zone.noFill) {
                this.ctx.fill();
            }
            this.ctx.stroke();
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
        if (zone.type !== 'symbol' && zone.type !== 'cloud') {
            this.ctx.fillStyle = 'white';
            this.ctx.font = `${14 / renderScale}px Inter`;
            this.ctx.shadowColor = "rgba(0,0,0,0.5)";
            this.ctx.shadowBlur = 4;
            
            let labelX, labelY;
            if (zone.type === 'polygon') {
                // Simple centroid approximation or just use bounding box center
                labelX = zone.x + zone.width / 2;
                labelY = zone.y + zone.height / 2;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
            } else {
                labelX = zone.x + 5 / renderScale;
                labelY = zone.y + 20 / renderScale;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'alphabetic';
            }
            
            this.ctx.fillText(zone.name, labelX, labelY);
            
            // Reset text align
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
            this.ctx.shadowBlur = 0;
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
        if (zone.type === 'polygon' || zone.type === 'cloud') {
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

                const updates = {
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
                if (!zone.date) return false; // No date = filtered out if date filter active
                
                const zoneDate = new Date(zone.date);
                if (filters.dateStart) {
                    const start = new Date(filters.dateStart);
                    if (zoneDate < start) return false;
                }
                if (filters.dateEnd) {
                    const end = new Date(filters.dateEnd);
                    if (zoneDate > end) return false;
                }
            }

            // Week Filter
            if (filters.week) {
                if (!zone.date) return false;
                
                const weekStr = getWeekDayString(zone.date); // e.g. "W42-3"
                if (!weekStr) return false;

                const weekPart = weekStr.split('-')[0].replace('W', ''); // "42"
                const weekNum = parseInt(weekPart, 10);
                
                // Parse filter input: "42" or "42-45"
                const filterInput = filters.week.trim();
                
                if (filterInput.includes('-')) {
                    const [startW, endW] = filterInput.split('-').map(s => parseInt(s.trim(), 10));
                    if (!isNaN(startW) && !isNaN(endW)) {
                        if (weekNum < startW || weekNum > endW) return false;
                    }
                } else {
                    const targetW = parseInt(filterInput, 10);
                    if (!isNaN(targetW)) {
                        if (weekNum !== targetW) return false;
                    }
                }
            }

            return true;
        });
    }

    handleStateChange(state) {
        // Redraw when state changes (e.g. filters, zones, etc.)
        this.draw();
    }

    exportPdf() {
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
            
            // Generate PDF
            const imgData = tempCanvas.toDataURL('image/jpeg', 0.8);
            const orientation = tempCanvas.width > tempCanvas.height ? 'l' : 'p';
            
            const doc = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [tempCanvas.width, tempCanvas.height]
            });
            
            doc.addImage(imgData, 'JPEG', 0, 0, tempCanvas.width, tempCanvas.height);
            doc.save('icoordinator-export.pdf');
            
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
