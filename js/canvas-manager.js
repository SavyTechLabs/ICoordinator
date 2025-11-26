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
        
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.polyPoints = []; // For polygon drawing
        
        this.activeTool = 'select'; // 'select', 'draw', 'poly'
        this.selectedZoneId = null;
        this.hoveredZoneId = null;
        this.resizeHandle = null; // 'tl', 'tr', 'bl', 'br' or index for poly

        this.backgroundImage = null;
        
        this.initEventListeners();
        this.resizeCanvas();
        
        // Subscribe to data changes to redraw
        this.dataManager.subscribe(() => {
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
        } else if (this.activeTool === 'poly') {
            // Polygon drawing logic
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
            // Check for resize handles first if a zone is selected
            if (this.selectedZoneId) {
                const zone = this.dataManager.getZone(this.selectedZoneId);
                this.resizeHandle = this.getResizeHandle(pos, zone);
                if (this.resizeHandle !== null) {
                    this.isResizing = true;
                    return;
                }
            }

            // Check for zone selection
            const clickedZone = this.getZoneAt(pos);
            
            if (clickedZone) {
                this.selectedZoneId = clickedZone.id;
                this.isDragging = true;
                this.uiManager.selectZone(clickedZone.id);
            } else {
                this.selectedZoneId = null;
                this.uiManager.selectZone(null);
                // Start panning if clicking on empty space
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
            }
            this.draw();
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.currentPos = pos;

        if (this.activeTool === 'draw' && this.isDrawing) {
            this.tempZone.width = pos.x - this.startPos.x;
            this.tempZone.height = pos.y - this.startPos.y;
            this.draw();
        } else if (this.activeTool === 'poly' && this.isDrawing) {
            this.draw(); // Redraw to show line to cursor
        } else if (this.isDragging && this.selectedZoneId) {
            const zone = this.dataManager.getZone(this.selectedZoneId);
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;
            
            let updatedZone;
            if (zone.type === 'polygon') {
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
            this.startPos = pos; // Reset start pos for continuous drag
        } else if (this.isResizing && this.selectedZoneId) {
            const zone = this.dataManager.getZone(this.selectedZoneId);
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
        
        this.isDragging = false;
        this.isResizing = false;
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
        // newOffset = mousePos * (oldScale - newScale) + oldOffset
        
        // However, getMousePos uses current offset and scale.
        // Let's use raw client coordinates relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        
        this.offsetX = clientX - (clientX - this.offsetX) * (newScale / oldScale);
        this.offsetY = clientY - (clientY - this.offsetY) * (newScale / oldScale);

        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));
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
        this.canvas.style.cursor = (tool === 'draw' || tool === 'poly') ? 'crosshair' : 'default';
        this.uiManager.updateToolState(tool);
        this.polyPoints = []; // Reset poly points if switching tools
        this.isDrawing = false;
    }

    getZoneAt(pos) {
        // Iterate in reverse to select top-most
        const zones = this.dataManager.getState().zones;
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            if (z.type === 'polygon') {
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
        
        if (zone.type === 'polygon') {
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
        if (zone.type === 'polygon') {
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
            type: 'polygon',
            points: [...this.polyPoints],
            // Calculate bounding box for simple checks
            x: Math.min(...this.polyPoints.map(p => p.x)),
            y: Math.min(...this.polyPoints.map(p => p.y)),
            width: Math.max(...this.polyPoints.map(p => p.x)) - Math.min(...this.polyPoints.map(p => p.x)),
            height: Math.max(...this.polyPoints.map(p => p.y)) - Math.min(...this.polyPoints.map(p => p.y)),
            color: '#2563EB',
            opacity: 0.5,
            name: this.uiManager.t('newPolygon'),
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

    setBackground(imageOrCanvas) {
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
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw Background
        if (this.backgroundImage) {
            this.ctx.drawImage(this.backgroundImage, 0, 0);
        }

        // Draw Zones
        const zones = this.dataManager.getState().zones;
        zones.forEach(zone => {
            this.drawZone(zone);
        });

        // Draw Temp Zone (while drawing rect)
        if (this.activeTool === 'draw' && this.isDrawing && this.tempZone) {
            this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
            this.ctx.strokeStyle = '#2563EB';
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.fillRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
        }

        // Draw Temp Polygon (while drawing poly)
        if (this.activeTool === 'poly' && this.polyPoints && this.polyPoints.length > 0) {
            this.ctx.strokeStyle = '#2563EB';
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
            this.ctx.fillStyle = '#2563EB';
            this.polyPoints.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 4 / this.scale, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }

        this.ctx.restore();
    }

    drawZone(zone) {
        const isSelected = zone.id === this.selectedZoneId;
        const state = this.dataManager.getState();
        
        // Determine color based on view mode
        let color = zone.color; // Default fallback
        
        if (state.viewMode === 'discipline') {
            const discipline = state.disciplines.find(d => d.id === zone.discipline);
            if (discipline) color = discipline.color;
        } else if (state.viewMode === 'status') {
            const status = state.statuses.find(s => s.id === zone.status);
            if (status) color = status.color;
        }

        this.ctx.fillStyle = hexToRgba(color, zone.opacity || 0.5);
        this.ctx.strokeStyle = isSelected ? '#F59E0B' : color;
        this.ctx.lineWidth = (isSelected ? 3 : 1) / this.scale;

        if (zone.type === 'polygon') {
            this.ctx.beginPath();
            if (zone.points && zone.points.length > 0) {
                this.ctx.moveTo(zone.points[0].x, zone.points[0].y);
                for (let i = 1; i < zone.points.length; i++) {
                    this.ctx.lineTo(zone.points[i].x, zone.points[i].y);
                }
                this.ctx.closePath();
            }
            this.ctx.fill();
            this.ctx.stroke();
        } else {
            this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
            this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        }

        // Draw Label
        this.ctx.fillStyle = 'white';
        this.ctx.font = `${14 / this.scale}px Inter`;
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
            labelX = zone.x + 5 / this.scale;
            labelY = zone.y + 20 / this.scale;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
        
        this.ctx.fillText(zone.name, labelX, labelY);
        
        // Reset text align
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.shadowBlur = 0;

        // Draw Connected Indicator (Checkmark)
        if (zone.customData && zone.customData._activityCode) {
            this.drawConnectionIndicator(zone);
        }

        // Draw Resize Handles if selected
        if (isSelected) {
            this.drawResizeHandles(zone);
        }
    }

    drawConnectionIndicator(zone) {
        const size = 16 / this.scale;
        const padding = 4 / this.scale;
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
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.stroke();
    }

    drawResizeHandles(zone) {
        const handleSize = 8 / this.scale;
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 1 / this.scale;

        let coords = [];
        if (zone.type === 'polygon') {
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
        const zone = this.getZoneAt(pos);

        if (zone) {
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                
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
                
            } catch (err) {
                console.error("Failed to parse dropped data", err);
            }
        }
    }
}
