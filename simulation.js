const canvas = document.getElementById('rayCanvas');
const ctx = canvas.getContext('2d');

// Canvas setup
canvas.width = 1300;
canvas.height = 1000;
let moon=null;
// Environment parameters
const earthHeight = 50;
const earthWidth=1200; // 12000km
const sunRadius = 5; // scale 1 pixel = 10km
let sunX = canvas.width / 2;
let sunY = canvas.height - earthHeight - 500; // initial 5000km above earth

// Observer parameters
const observerRadius = 5; // 20km diameter
const observerHeight = 2; // 1000km above earth
let observerX = canvas.width / 2;
let observerY = canvas.height - earthHeight - observerHeight;

// Ray hit storage
let viewVectors = [];
const mountainCount = 38;
const cloudCount = 32;
const refractionLines = 10;

// Replace the refractiveLayers initialization with empty array
const refractiveLayers = [];

// View and interaction parameters
let viewX = 0;
let viewY = 0;
let zoom = 1;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Add new sun dragging variables
let isDraggingSun = false;
let isDraggingMoon = false;

// Transform functions
function worldToScreen(x, y) {
    return {
        x: (x - viewX) * zoom,
        y: (y - viewY) * zoom
    };
}

function screenToWorld(x, y) {
    return {
        x: x / zoom + viewX,
        y: y / zoom + viewY
    };
}

// Objects storage
const mountains = [];
const clouds = [];
let sortedYPositions = [];

// Mouse interaction

class Mountain {
    constructor() {
        
        this.height = 1.2+Math.random() * 3;
        this.width = 3+this.height * 3;
        this.x = Math.random() * (earthWidth - this.width);
    }

    draw() {
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.moveTo(this.x, canvas.height - earthHeight);
        ctx.lineTo(this.x + this.width/2, canvas.height - earthHeight - this.height);
        ctx.lineTo(this.x + this.width, canvas.height - earthHeight);
        ctx.fill();
    }

    intersect(x1, y1, x2, y2) {
        // Line segment intersection with triangle
        const baseY = canvas.height - earthHeight;
        const peakX = this.x + this.width/2;
        const peakY = baseY - this.height;

        // Check if ray is outside mountain x-bounds
        if (x2 < this.x || x2 > this.x + this.width) return null;

        // Calculate intersection with horizontal line at current y
        const slope = (y2 - y1) / (x2 - x1);
        
        // Left slope of triangle
        const leftSlope = (peakY - baseY) / (peakX - this.x);
        // Right slope of triangle
        const rightSlope = (peakY - baseY) / (peakX - (this.x + this.width));
        
        // Calculate y position at current x on both triangle slopes
        const x = x2;
        const leftY = baseY + leftSlope * (x - this.x);
        const rightY = baseY + rightSlope * (x - (this.x + this.width));
        
        // Get the higher y value (the actual triangle edge at this x)
        const triangleY = x <= peakX ? leftY : rightY;
        
        // If ray y is below triangle edge, we have a hit
        if (y2 >= triangleY) {
            return {x: x2, y: triangleY};
        }
        
        return null;
    }
}

class Cloud {
    constructor() {
        this.width = 5 + Math.random() * 15;
        this.height = 0.5 + Math.random() * 0.5;
        this.x = Math.random() * (earthWidth - this.width);
        this.y = canvas.height - earthHeight - (2 + Math.random() * 2);
    }

    draw() {
        
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 5);
        ctx.fill();
    }

    intersect(x1, y1, x2, y2) {
        // Simplified box intersection
        if (x1 >= this.x && x1 <= this.x + this.width &&
            y1 >= this.y && y1 <= this.y + this.height) {
            return {x: x1, y: y1};
        }
        return null;
    }
}

function initialize() {
    // Create mountains
    for (let i = 0; i < mountainCount; i++) {
        mountains.push(new Mountain());
    }

    // Create clouds
    for (let i = 0; i < cloudCount; i++) {
        clouds.push(new Cloud());
    }
    clouds[0].width=sunRadius*2;
    clouds[0].height=sunRadius*2;
    clouds[0].x=400;
    clouds[0].y=sunY+50;
    moon=clouds[0];



    // Remove old mouse events
    canvas.addEventListener('mousedown', startPan);
    canvas.addEventListener('mousemove', pan);
    canvas.addEventListener('mouseup', endPan);
    canvas.addEventListener('wheel', handleZoom);

    // Add slider control
    const sunSlider = document.getElementById('sunSlider');
    sunSlider.addEventListener('input', (e) => {
        sunX = parseInt(e.target.value);
        render();
    });
    // Add slider control
    const obSlider = document.getElementById('obSlider');
    obSlider.addEventListener('input', (e) => {
        observerX = parseInt(e.target.value);
        viewVectors = [];
        render();
    });
    const zoomSlider = document.getElementById('zoomSlider');
    zoomSlider.addEventListener('input', (e) => {
        zoom = parseFloat(e.target.value);
        render();
    });

    document.getElementById('resetView').addEventListener('click', () => {
        viewX = 0;
        viewY = 0;
        zoom = 1;
        zoomSlider.value = "1";
        render();
    });

    // Initialize layers from default text input
    updateLayers();

    // Add sun height slider control
    const sunHeightSlider = document.getElementById('sunHeightSlider');
    sunHeightSlider.addEventListener('input', (e) => {
        sunY = canvas.height - earthHeight - parseInt(e.target.value);
        render();
    });
}

// Replace updateLayersFromText with new updateLayers function
function updateLayers() {
    const layerHeight = parseFloat(document.getElementById('layerHeight').value);
    const layerCount = parseInt(document.getElementById('layerCount').value);
    const topIndex = parseFloat(document.getElementById('topIndex').value);
    const bottomIndex = parseFloat(document.getElementById('bottomIndex').value);
    
    // Clear existing layers
    refractiveLayers.length = 0;
    
    // Create new layers with linear interpolation of refractive indices
    for (let i = 0; i < layerCount; i++) {
        const t = i / (layerCount - 1);
        refractiveLayers.push({
            y: canvas.height - earthHeight - (i + 1) * layerHeight,
            
            index: bottomIndex + (topIndex - bottomIndex) * t
        });
    }
    
    // Sort layers by height (highest y value = top layer)
    refractiveLayers.sort((a, b) => b.y - a.y);
    viewVectors = [];
    render();
}
let isDraggingObserver = false;
function startPan(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom + viewX;
    const mouseY = (e.clientY - rect.top) / zoom + viewY;
    
    // Middle mouse button (button 1) drags observer, sun or moon based on position
    if (e.button === 1) {
        const dragMoon = document.getElementById('dragMoon').checked;
        
        // If near earth box (bottom 100px), drag observer
        if (mouseY > canvas.height - earthHeight - 100) {
            isDragging = false;
            isDraggingSun = false;
            isDraggingMoon = false;
            isDraggingObserver = true;
        } else if (dragMoon && moon) {
            // If dragging moon and mouse is near moon, drag moon
            isDraggingMoon = true;
            isDraggingSun = false;
        } else {
            // Otherwise drag sun
            isDraggingSun = true;
            isDraggingMoon = false;
        }
        document.body.style.cursor = 'move';
        e.preventDefault(); // Prevent default middle-click behavior
    }

    // Otherwise pan the view
    else if (e.button === 0) {
        isDragging = true;
    }
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
}

// Add middle button up detection
window.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isDraggingSun = false;
        isDraggingMoon = false;
        document.body.style.cursor = 'default';
    }
});

// Prevent middle click scroll on canvas
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
});

function pan(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom + viewX;
    const mouseY = (e.clientY - rect.top) / zoom + viewY;
    
    if (isDraggingSun) {
        // Update sun position
        sunX = Math.max(0, Math.min(canvas.width, mouseX));
        sunY = Math.max(0, Math.min(canvas.height - earthHeight - 10, mouseY));
        
        // Update UI sliders
        document.getElementById('sunSlider').value = Math.round(sunX);
        document.getElementById('sunHeightSlider').value = 
            Math.round(canvas.height - earthHeight - sunY);
    } else if (isDraggingMoon && moon) {
        // Update moon position
        moon.x = Math.max(0, Math.min(canvas.width - moon.width, mouseX));
        moon.y = Math.max(0, Math.min(canvas.height - earthHeight - moon.height, mouseY));
    } else if (isDraggingObserver) {
        // Update observer position
        observerX = Math.max(0, Math.min(canvas.width, mouseX));
        observerY = Math.max(canvas.height - earthHeight - observerHeight, 
            Math.min(canvas.height - earthHeight, mouseY));
        // Update UI slider
        document.getElementById('obSlider').value = Math.round(observerX);
        viewVectors = [];
    } else if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        viewX -= dx / zoom;
        viewY -= dy / zoom;
    }
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    render();
}

function endPan() {
    isDragging = false;
    isDraggingSun = false;
    isDraggingMoon = false;
    isDraggingObserver = false;
    document.body.style.cursor = 'default';
}

// Add hover effect for sun and moon
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging && !isDraggingSun && !isDraggingMoon) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / zoom + viewX;
        const mouseY = (e.clientY - rect.top) / zoom + viewY;
        
        const dragMoon = document.getElementById('dragMoon').checked;
        const nearSun = Math.hypot(mouseX - sunX, mouseY - sunY) < 20;
        const nearMoon = moon && Math.hypot(mouseX - moon.x, mouseY - moon.y) < 20;
        
        if (nearSun || (dragMoon && nearMoon)) {
            document.body.style.cursor = 'move';
        } else {
            document.body.style.cursor = 'default';
        }
    }
});

function handleZoom(e) {
    const delta = -Math.sign(e.deltaY) * 0.1;
    const oldZoom = zoom;
    zoom = Math.max(0.5, Math.min(15, zoom + delta));
    
    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    viewX += mouseX * (1/oldZoom - 1/zoom);
    viewY += mouseY * (1/oldZoom - 1/zoom);
    
    document.getElementById('zoomSlider').value = zoom;
    render();
    e.preventDefault();
}

function drawEnvironment() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#203080');
    gradient.addColorStop(1, '#4070C0'); // Dark blue
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply transform
    ctx.scale(zoom, zoom);
    ctx.translate(-viewX, -viewY);

    // Draw earth
    ctx.fillStyle = 'rgb(184, 133, 38)';
    ctx.fillRect(0, canvas.height - earthHeight, earthWidth, earthHeight);

    // Draw mountains
    mountains.forEach(m => m.draw());

    // Draw clouds
    clouds.forEach(c => c.draw());

    // Draw refraction lines with their indices
    refractiveLayers.forEach(layer => {
        ctx.strokeStyle = `rgba(200, 200, 255, 0.2)`;
        ctx.beginPath();
        ctx.moveTo(0, layer.y);
        const h=layer.y-(canvas.height - earthHeight);
        
        ctx.lineWidth = 1/zoom;
        ctx.lineTo(canvas.width, layer.y);
        ctx.stroke();
        
        // Draw refractive index value
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.font = '9px Arial';
        ctx.fillText(h*10+'km, '+layer.index.toFixed(2), 10+viewX, layer.y - 2);
    });
    // Draw refractive index value
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.font = '9px Arial';
    const h=sunY-(canvas.height - earthHeight);
    ctx.fillText(h*-10+'km', 10+viewX, sunY - 2);

    ctx.font = '19px Arial';
    
    ctx.fillText("Flat Earth width "+earthWidth*10+'km', 10+viewX, 5+canvas.height - earthHeight/2);

    ctx.restore();
}

function getRefractiveIndex(y) {
    // Find the surrounding layers
    let upperLayer = refractiveLayers[refractiveLayers.length - 1];
    let lowerLayer = refractiveLayers[0];
    
    // Above all layers
    if (y <= upperLayer.y) return upperLayer.index;
    
    // Below all layers
    if (y >= lowerLayer.y) return lowerLayer.index;
    
    // Find surrounding layers
    for (let i = 0; i < refractiveLayers.length - 1; i++) {
        if (y >= refractiveLayers[i+1].y && y <= refractiveLayers[i].y) {
            const top = refractiveLayers[i+1];
            const bottom = refractiveLayers[i];
            return top.index;
        }
    }
    
    return 1.0;
}

// Optimize ray tracing with cached calculations and better checks
// Add Fresnel calculation helper function
function calculateFresnelReflectance(n1, n2, cosI) {
    // Handle total internal reflection
    const r = n1 / n2;
    const sinT2 = r * r * (1.0 - cosI * cosI);
    if (sinT2 >= 1.0) {
        return 1.0; // Total internal reflection
    }

    const cosT = Math.sqrt(1.0 - sinT2);
    const Rs = ((n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT)) ** 2;
    const Rp = ((n1 * cosT - n2 * cosI) / (n1 * cosT + n2 * cosI)) ** 2;
    
    // Return average of S and P polarizations
    return (Rs + Rp) / 2.0;
}

function traceRay(startX,ref) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-viewX, -viewY);
    ctx.lineWidth = 1/zoom;
    
    let x = sunX;
    let y = sunY;

    
    // Pre-calculate target direction
    const targetY = canvas.height - earthHeight;
    const dx = startX - x;
    const dy = targetY - y;
    let dir = Math.atan2(dy, dx);
    
    // Skip if ray is going upward
    if (dir < 0) {
        ctx.restore();
        return;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    let isInShadow = false;
    let currentRefractiveIndex = getRefractiveIndex(y);
    const stepSize = 2/zoom;

    // Cache commonly used values
    const canvasWidth = canvas.width;
    const earthY = canvas.height - earthHeight;

    let lastHit = null;

    while (y < earthY && y >= 0 && x >= 0 && x <= canvasWidth) {
        const cos_dir = Math.cos(dir);
        const sin_dir = Math.sin(dir);
        const nextX = x + cos_dir * stepSize;
        const nextY = y + sin_dir * stepSize;
        
        // Get new refractive index
        const newRefractiveIndex = getRefractiveIndex(nextY);
        
        if (Math.abs(newRefractiveIndex - currentRefractiveIndex) > 0.001) {
            // Complete current path
            ctx.strokeStyle = isInShadow ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 0, 0.25)';
            ctx.stroke();
            if (!isInShadow) {
                
                // Calculate incident angle from vertical (normal)
                const normal = -Math.PI/2; // Pointing upward
                const incident = dir - normal;
                
                // Calculate Fresnel reflection
                const cosI = Math.abs(Math.cos(incident));
                const reflectance = calculateFresnelReflectance(
                    currentRefractiveIndex, 
                    newRefractiveIndex, 
                    cosI
                );

                // Fake reflection intensity based on the angle
                const fakeReflectance = Math.abs(Math.sin(incident));
                
                // Draw reflected ray if reflectance is significant
                if (fakeReflectance > 0.0001 && ref) {
                    // Calculate reflection angle: angle of reflection equals angle of incidence
                    // const reflectedAngle = -dir;
                    
                    // // Draw reflected ray as separate path
                    // ctx.beginPath();
                    // ctx.moveTo(x, y);
                    
                    // // Trace reflected ray
                    // const reflectedLength = 100;
                    // const rx = x + Math.cos(reflectedAngle) * reflectedLength;
                    // const ry = y + Math.sin(reflectedAngle) * reflectedLength;
                    
                    // ctx.lineTo(rx, ry);
                    // ctx.strokeStyle = `rgba(255, 0, 0, ${fakeReflectance * 0.5})`;
                    // //ctx.lineWidth = 1;
                    // ctx.stroke();

                }
                // Continue with refraction
                const sinTheta2 = (currentRefractiveIndex * Math.sin(incident)) / newRefractiveIndex;
                if (Math.abs(sinTheta2) <= 1) {
                    dir = Math.PI/2 - Math.asin(sinTheta2);
                }
                
                currentRefractiveIndex = newRefractiveIndex;
            }
            
            // Start new path for continuing ray
            ctx.beginPath();
            ctx.moveTo(x, y);
            
        }

        // Quick boundary check for mountains
        let hitObject = false;
        
        // Check intersections in order of y position
        for (const yPos of sortedYPositions) {
            if (nextY >= yPos) {
                // Check clouds first if not in shadow
                if (!isInShadow) {
                    for (let cloud of clouds) {
                        if (cloud.y === yPos && 
                            nextX >= cloud.x && nextX <= cloud.x + cloud.width &&
                            nextY >= cloud.y && nextY <= cloud.y + cloud.height) {
                            ctx.strokeStyle = 'rgba(255, 255, 0, 0.25)';
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            isInShadow = true;
                            break;
                        }
                    }

                    // Check mountains
                    for (let mountain of mountains) {
                        if (canvas.height - earthHeight - mountain.height === yPos &&
                            nextX >= mountain.x && nextX <= mountain.x + mountain.width) {
                            const hit = mountain.intersect(x, y, nextX, nextY);
                            if (hit) {
                                // Calculate refracted ray direction using Snell's law
                                const n1 = getRefractiveIndex(hit.y);
                                const n2 = 1.0; // Observer is in air
                                
                                // Calculate incident angle (angle between ray and surface normal)
                                const surfaceNormal = {x: 0, y: 1}; // Flat earth surface
                                const incidentAngle = Math.acos(
                                    (surfaceNormal.x * (x - hit.x) + surfaceNormal.y * (y - hit.y)) /
                                    Math.hypot(x - hit.x, y - hit.y)
                                );
                                
                                // Calculate refracted angle using Snell's law
                                const refractedAngle = Math.asin((n1/n2) * Math.sin(incidentAngle));
                                
                                
                                
                                ctx.strokeStyle = isInShadow ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 0, 0.25)';
                                ctx.lineTo(hit.x, hit.y);
                                ctx.stroke();
                                ctx.beginPath();
                                ctx.moveTo(x, y);
                                isInShadow = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        x = nextX;
        y = nextY;
        ctx.lineTo(x, y);
    }

    // Check for observer intersection with last ray segment
    const lastRayStart = {x: x - Math.cos(dir) * stepSize, y: y - Math.sin(dir) * stepSize};
    const lastRayEnd = {x: x, y: y};
    
    // Calculate intersection between last ray segment and observer circle
    const rayDx = lastRayEnd.x - lastRayStart.x;
    const rayDy = lastRayEnd.y - lastRayStart.y;
    const dr = Math.hypot(rayDx, rayDy);
    const D = Math.hypot(lastRayStart.x - observerX, lastRayStart.y - observerY);
    
    
    if (D < observerRadius) {

        // Save view vector based on refracted ray
        viewVectors.push({
            x: lastRayEnd.x,
            y: lastRayEnd.y,
            normalX: -rayDx / dr,
            normalY: -rayDy / dr
        });
        // sort the viewVectors by x
        viewVectors.sort((a, b) => a.x - b.x);
        // if length more than 5 delete random index from 1 to length-2
        if (viewVectors.length > 10){
            viewVectors.splice(Math.floor(Math.random() * (viewVectors.length-2))+1, 1);
        }
    }

    ctx.strokeStyle = isInShadow ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 0, 0.25)';
    ctx.stroke();
    ctx.restore();
}

function getVisibleRange() {
    // Convert screen boundaries to world coordinates
    const leftWorld = viewX-10;
    const rightWorld = viewX + (earthWidth+40) / zoom;
    
    // Clamp to earth width
    const visibleLeft = Math.max(0, Math.min(earthWidth, leftWorld));
    const visibleRight = Math.max(0, Math.min(earthWidth, rightWorld));
    
    return { left: visibleLeft, right: visibleRight };
}
let lastRender = 0;
function drawViewVectors() {
    if (viewVectors.length > 0) {
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-viewX, -viewY);
        
        
        // If multiple vectors, calculate and draw apparent sun
        if (viewVectors.length > 1) {
            // Find intersection point of extended vectors
            const v1 = viewVectors[0];
            const v2 = viewVectors[viewVectors.length - 1];
            
            // Calculate intersection using line equations
            const m1 = v1.normalY / v1.normalX;
            const m2 = v2.normalY / v2.normalX;
            
            const x = (m1 * v1.x - m2 * v2.x + v2.y - v1.y) / (m1 - m2);
            const y = m1 * (x - v1.x) + v1.y;
            const D = Math.hypot(x - v1.x, y - v1.y)*1.3;
            // Draw view vector extensions
            viewVectors.forEach(vector => {
                // Draw extension line
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.moveTo(vector.x, vector.y);
                ctx.lineTo(vector.x + vector.normalX * D, 
                        vector.y + vector.normalY * D);
                ctx.stroke();
            });
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
            ctx.moveTo((v1.x+v2.x)/2, (v1.y+v2.y)/2);
            ctx.lineTo(sunX ,sunY);
            ctx.stroke();
            // Draw apparent sun
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
let lastSunX=0;
function render() {
    if (Date.now() - lastRender < 1000 / 30) return;
    // Create sorted list of all y positions
    sortedYPositions = [
        ...mountains.map(m => canvas.height - earthHeight - m.height),
        ...clouds.map(c => c.y)
    ].sort((a, b) => a - b);
    lastRender = Date.now();
    if (lastSunX!=sunX){
        viewVectors=[];lastSunX=sunX;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawEnvironment();
    
    // Calculate visible earth section
    const visible = getVisibleRange();
    const visibleWidth = visible.right - visible.left;
    
    // Distribute rays across visible area
    const rayCount = 100;
    const raySpacing = visibleWidth / rayCount;
    
    for (let i = 0; i < rayCount; i++) {
        const targetX = visible.left + (i * raySpacing);
        traceRay(targetX, i % 5 === 0);
    }
    
    // Draw observer
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-viewX, -viewY);
    
    ctx.strokeStyle = 'cyan';
    ctx.beginPath();
    ctx.arc(observerX, observerY, observerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();

    // Draw sun last so it's always visible
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-viewX, -viewY);
    
    // Draw hover area if mouse is near
    if (document.body.style.cursor === 'move' && !isDraggingSun && !isDraggingMoon) {
        ctx.beginPath();
        ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        ctx.fill();
    }
    
    // Draw sun
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    drawViewVectors();
}

initialize();
render(); // Initial render
// Remove animate() call
