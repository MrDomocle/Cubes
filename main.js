import * as THREE from 'three';
import * as PARSE from './parser.js';
import * as PATTERNS from './patterns.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

var clock = new THREE.Clock();
var delta = 0;

var speed = 10;
var speed_curve = 2;

const CURVE_COUNT = 5;

const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: "low-power", });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
const ambientLight = new THREE.AmbientLight();
scene.add(directionalLight);
scene.add(ambientLight);
directionalLight.position.set(5,10,5);

camera.position.z = 15;

// Define a cubic Bézier curve for transitions
// Chatgpt wrote this function, i didnt have the time
let curves;
function randomiseCurves() {
    curves = new Array();
    for (let i = 0; i < CURVE_COUNT; i++) {
        const array = [];

        // Generate the 1st and 2nd Vector3s
        for (let j = 0; j < 2; j++) {
            const x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * (45 - 25) + 25);
            const y = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * (45 - 25) + 25);
            const z = Math.random() * (10 - (-10)) + (-10);
            array.push(new THREE.Vector3(x, y, z));
        }

        // Generate the 3rd Vector3
        const x3 = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * (60 - 50) + 50);
        const y3 = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * (60 - 50) + 50);
        const z3 = Math.random() * (10 - (-10)) + (-10);
        array.push(new THREE.Vector3(x3, y3, z3));

        curves.push(array);
    }

    // for (let i = 0; i < curves.length; i++) {
    //     drawCurve(i)
    // }
}

let doControl = true;
let controls;
if (doControl) {
    window.addEventListener("keydown", handleKeys);
    window.addEventListener("paste", handlePaste);
    controls = new OrbitControls(camera, renderer.domElement);
}

// MARK: Cube
// Individual cube class.
// Holds the cube mesh and all targets
class Cube {
    target_rotate;
    target_translate;
    target_curve;
    target_curve_end;

    curve_t;
    curve_t_t;

    geometry;
    material;
    mesh;

    done_rotate;
    done_translate;
    done_curve;

    destroy_on_curve_end;

    offset;
    index;

    constructor(pos, ofs, ix, grp, quat = new THREE.Quaternion().identity()) {
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshStandardMaterial({color: 0xffffff});

        this.mesh = new THREE.Mesh(this.geometry, this.material);

        this.mesh.position.copy(pos);
        this.mesh.rotation.setFromQuaternion(quat);

        this.target_translate = new THREE.Vector3().copy(pos);
        this.target_rotate = new THREE.Quaternion().copy(quat);

        this.done_rotate = true;
        this.done_translate = true;
        this.done_curve = true;
        this.curve_t = 0.02;
        this.curve_t_t = 0;

        this.offset = new THREE.Vector3().copy(ofs);
        this.index = ix;

        grp.add(this.mesh);
    }
    // Takes vector3 point and sets target_rotation to look at it
    setLookTarget(tg) {
        let tg_v = new THREE.Vector3().subVectors(tg, this.mesh.position).normalize();
        this.target_rotate = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), tg_v)
        this.done_rotate = false;
    }
    // Blindly sets target_rotation
    setRotTarget(rot) {
        this.target_rotate.copy(rot);
        this.done_rotate = false;
    }
    // Set rotation immeditately
    snapRot(rot) {
        this.mesh.rotation.setFromQuaternion(rot);
        this.target_rotate.copy(rot);
        this.done_rotate = true;
    }

    // Sets translate and adds offset to keep shape of overall cube formation
    setTranslateTargetRelative(pos) {
        this.target_translate.copy(pos).add(this.offset);
        this.done_translate = false;
    }
    // Blindly set target
    setTranslateTarget(pos) {
        this.target_translate.copy(pos);
        this.done_translate = false;
    }

    // Set to move along Bezier curve
    setCurve(p1,p2,end, destroy) {
        this.target_curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3().copy(this.mesh.position),
            new THREE.Vector3().copy(p1),
            new THREE.Vector3().copy(p2),
            new THREE.Vector3().copy(end)
        );
        this.target_curve_end = new THREE.Vector3().copy(end);
        this.done_curve = false;
        this.curve_t = 0;
        this.curve_t_t = 0;
        this.destroy_on_curve_end = destroy;
    }

    update() {
        if (!this.done_rotate) {
            this.mesh.quaternion.slerp(this.target_rotate, speed*delta);
            if (this.mesh.quaternion.angleTo(this.target_rotate) < 0.01) {
                this.done_rotate = true;
            }
        }

        if (!this.done_curve) {
            // Exponential growth of t
            this.curve_t_t += delta;
            this.curve_t = Math.pow(speed_curve, this.curve_t_t)-1;
            
            this.mesh.position.copy(this.target_curve.getPoint(this.curve_t));
            if (this.curve_t > 0.999) {
                this.done_curve = true;
                cubeCtrl.cubesLeft--;
                if (this.destroy_on_curve_end) {
                    cubeCtrl.cubeGroup.remove(this.mesh);
                } else {
                    this.mesh.position.copy(this.target_curve_end);
                }
            }
        } else if (!this.done_translate) {
            this.mesh.position.lerp(this.target_translate, speed*delta);
            if (this.mesh.position.distanceTo(this.target_translate) < 0.01) {
                this.done_translate = true;
            }
        }
        
    }
}

// MARK: CubeCtrl
// Cube controller - each can be assigned Cube objects. Cubes should not be manipulated directly, but through a CubeController.
class CubeController {
    cubes;
    cubeGroup;
    cubeGroupAnchor;
    cubesLeft;
    origin;

    waveActive;
    waveTarget;
    waveTime;
    waveLength;
    waveWidth;

    cubesX;
    cubesY;
    cubesStep;

    hoverPeriod;
    hoverAmplitude;
    hoverTurnPeriod;
    hoverTurnAmplitude;
    hoverActive;
    hoverProgress;
    hoverTurnProgress;

    curveInterval;
    curveCallback;
    curveDone;

    constructor() {
        this.cubes = new Array();
        this.cubeGroup = new THREE.Group();
        this.cubeGroupAnchor = new THREE.Vector3(0,0,0);
        scene.add(this.cubeGroup);
        this.origin = new THREE.Vector3(0,0,0);
        this.waveActive = false;
        this.cubesX = 0;
        this.cubesY = 0;
        this.hoverActive = false;
        this.curveInterval = null;
        this.cubesLeft = 0;
        this.curveDone = true;
    }
    addCube(x,y, step, hide=false) {
        this.cubes.push(new Cube(
            new THREE.Vector3(x*step,y*step,0),
            new THREE.Vector3(x*step,y*step,0),
            {x:x,y:y},
            this.cubeGroup
        ));
        if (hide) {
            this.cubes[this.cubes.length-1].mesh.position.set(69420,69420,0);
        }
        this.cubesLeft++;
        this.cubesStep = step;
    }

    setLookAll(tg) {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setLookTarget(tg);
        }
    }
    setLookAllSame(tg) {
        let dir = new THREE.Vector3().subVectors(tg, this.origin).normalize();
        let rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setRotTarget(rot);
        }
    }
    setRotateAll(rot) {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setRotTarget(rot);
        }
    }
    snapRotateAll(rot) {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].snapRot(rot);
        }
    }

    setTranslateAll(pos) {
        this.origin.copy(pos);
        for (let i = 0; i < this.cubes.length; i++) {
            setTimeout(() => {
                this.cubes[i].setTranslateTargetRelative(pos);
            }, Math.random()*200);
        }
    }
    setTranslate(pos, i=0) {
        this.cubes[i].setTranslateTarget(pos);
    }

    setCurveOutAll(cb = null) {
        if (!this.curveDone) { return; }
        try {
            clearInterval(this.curveInterval);
        } catch {

        }
        randomiseCurves();
        this.curveDone = false;
        this.curveCallback = cb;
        this.cubesLeft = this.cubes.length;
        let t = -Math.floor(this.cubesX/2)-Math.floor(this.cubesY/2);
        this.curveInterval = setInterval( () => {
            if (t >= this.cubesX) { clearInterval(this.curveInterval); console.log("done"); }
            for (let i = 0; i < this.cubes.length; i++) {
                if (this.cubes[i].index.y-this.cubes[i].index.x == t) {
                    setTimeout( () => {
                        let curve = (t+this.cubesX) % curves.length;

                        this.cubes[i].setCurve(
                            curves[curve][0],
                            curves[curve][1],
                            curves[curve][2],
                            true
                        );
                    }, Math.random()*60)
                }
            }

            t++;
        }, 20);
    }
    setCurveInAll(cb = null) {
        if (!this.curveDone) { return; }
        try {
            clearInterval(this.curveInterval);
        } catch {

        }
        randomiseCurves();
        this.curveDone = false;
        this.curveCallback = cb;
        this.cubesLeft = this.cubes.length;
        let t = -Math.floor(this.cubesX/2)-Math.floor(this.cubesY/2);
        this.curveInterval = setInterval( () => {
            if (t >= this.cubesX) { clearInterval(this.curveInterval); console.log("done"); }
            for (let i = 0; i < this.cubes.length; i++) {
                if (this.cubes[i].index.y-this.cubes[i].index.x == t) {
                    setTimeout( () => {
                        let curve = (t+this.cubesX) % curves.length;
                        this.cubes[i].mesh.position.copy(curves[curve][2]);

                        this.cubes[i].setCurve(
                            curves[curve][1],
                            curves[curve][0],
                            new THREE.Vector3(this.cubes[i].index.x*this.cubesStep, this.cubes[i].index.y*this.cubesStep, 0),
                            false
                        );

                    }, Math.random()*60)
                }
            }

            t++;
        }, 20);
    }
    resetCurve() {
        console.log("curve done");
        this.curveDone = true;
    }

    // Mg - magnitude of swipe
    // Time - time to complete
    // Width - how wide the wave is in relation to total diagonal length of pattern (<1)
    swipeAll(mg, time, width) {
        let tg = new THREE.Vector3(-1,1,0).multiplyScalar(mg);
        let dir = new THREE.Vector3().subVectors(tg, this.origin).normalize();
        let rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
        this.waveTarget = rot;
        this.waveLength = time;
        this.waveWidth = Math.ceil((this.cubesX+this.cubesY)*width);
        this.waveTime = 0;
        this.waveActive = true;
    }
    enableHover(amplitude, period, t_amplitude, t_period) {
        this.hoverAmplitude = amplitude;
        this.hoverPeriod = period;
        this.hoverTurnAmplitude = t_amplitude;
        this.hoverTurnPeriod = t_period;
        this.hoverActive = true;
        this.hoverProgress = 0;
        this.hoverTurnProgress = 0;
    }
    disableHover() {
        this.hoverActive = false;
    }

    setAnchor(x,y,z) {
        this.cubeGroup.position.set(x,y,z);
        this.cubeGroupAnchor.set(x,y,z);
    }

    updateAll() {
        // Wave
        if (this.waveActive) {
            this.waveTime += delta;
            this.waveActive = this.waveTime < this.waveLength;
            if (this.waveActive) {
                let step = Math.floor((this.cubesX+this.cubesY)*(this.waveTime/this.waveLength));
                
                let diagonal = step-this.cubesY+1;

                for (let i = 0; i < this.cubes.length; i++) {
                    // total number of diagonals * proportion of wave width to total size of pattern
                    if (Math.abs(this.cubes[i].index.y-this.cubes[i].index.x - diagonal) < this.waveWidth) {
                        this.cubes[i].setRotTarget(this.waveTarget);
                    } else  {
                        this.cubes[i].setRotTarget(new THREE.Quaternion().identity());
                    }
                }
            } else {
                this.setRotateAll(new THREE.Quaternion().identity())
            }
        }
        // Hover
        if (this.hoverActive) {
            this.hoverProgress += delta/(this.hoverPeriod/(2*Math.PI));
            this.hoverTurnProgress += delta/(this.hoverTurnPeriod/(2*Math.PI));
            // translation
            this.cubeGroup.position.y = this.cubeGroupAnchor.y + Math.sin(this.hoverProgress)*this.hoverAmplitude;
            this.cubeGroup.rotation.y = Math.sin(this.hoverTurnProgress)*this.hoverTurnAmplitude;
            this.cubeGroup.rotation.z = Math.cos(this.hoverTurnProgress)*this.hoverTurnAmplitude;
            if (this.hoverProgress > 2*Math.PI) {
                this.hoverProgress = 0;
            }
            if (this.hoverTurnProgress > 2*Math.PI) {
                this.hoverTurnProgress = 0;
            }
        }
        // Apply and check curve transition status
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].update();
        }

        if (this.cubesLeft <= 0 && !this.curveDone) {
            if (this.curveCallback != null) {
                this.curveCallback();
            }
        }
    }

    removeAll() {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubeGroup.remove(this.cubes[i].mesh);
        }
        try {
            clearInterval(this.curveInterval);
            t = 0;
            k = 0;
        } catch {

        }
    }
}
let cubeCtrl = new CubeController();

// MARK: Spawn
function spawn(parse = null, hide = false) {
    cubeCtrl.removeAll();
    cubeCtrl = new CubeController();
    let step = 1.2;
    if (parse == null) {
        cubeCtrl.cubesX = 24;
        cubeCtrl.cubesY = 24;
        for (let x = -12; x < 12; x++) {
            for (let y = -12; y < 12; y++) {
                cubeCtrl.addCube(x,y,step, hide);
            }
        }
    } else {
        
        if (parse.x & 1) { parse.x++ }
        if (parse.y & 1) { parse.y++ }
        
        cubeCtrl.cubesX = parse.x;
        cubeCtrl.cubesY = parse.y;
        let xStart = -Math.floor(parse.x/2);
        let xEnd = -xStart;
        let yStart = -Math.floor(parse.y/2);
        let yEnd = -yStart;

        for (let x = xStart; x < xEnd; x++) {
            for (let y = yStart; y < yEnd; y++) {
                try {
                    if (parse.block[y-yStart][x-xStart]) {
                        cubeCtrl.addCube(x,-y,step, hide);
                    }
                } catch {

                }
            }
        }
    }
    console.log(cubeCtrl.cubes.length+" cubes"); 
}

// MARK: Draw/UI
function animate() {
    delta = clock.getDelta();
    cubeCtrl.updateAll();
    if (doControl) { controls.update(); }

	renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

function changeSpeed(e) {
    console.log("set speed to "+e.target.value);
    speed = e.target.value;
}
function changeSpeedCurve(e) {
    speed_curve = e.target.value;
    console.log("set speed_curve to "+e.target.value);
}

function handleKeys(e) {
    if (e.key == "l") {
        cubeCtrl.setLookAll(camera.position);
    }
    if (e.key == "s") {
        cubeCtrl.setLookAllSame(camera.position);
    }
    if (e.key == "t") {
        cubeCtrl.setTranslateAll(camera.position);
    }
    if (e.key == "d") {
        cubeCtrl.setCurveOutAll(cubeCtrl.resetCurve);
    }
    if (e.key == "f") {
        insertPattern(PATTERNS.patterns[patternPick]);
        cubeCtrl.setCurveInAll(cubeCtrl.resetCurve);
    }
    if (e.key == "j") {
        cubeCtrl.swipeAll(1000,2,1/32);
    }
    if (e.key == "g") {
        cubeCtrl.disableHover();
    }
    if (e.key == "p") {
        console.log(camera.position);
    }
    if (e.key == "x") {
        cubeCtrl.removeAll();
        spawn();
    }
}


// Debug for making curve settings
function drawCurve(i) {
    const bezierCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(0,0,0), curves[i][0], curves[i][1], curves[i][2]);

    // Visualize the curve
    let points = bezierCurve.getPoints(50);
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({ color: 0xffffff });
    let curveLine = new THREE.Line(geometry, material);

    scene.add(curveLine);
}

// Call this with a RLE/Plaintext string to set cube pattern
export function insertPattern(str) {
    let type = PARSE.getPatternType(str);
    let parse;
    if (type == "plaintext") {
        parse = PARSE.parsePlaintext(str);
    } else if (type == "rle") {
        parse = PARSE.parseRle(str);
    } else {
        console.log("Not a recognised pattern");
        return;
    }
    spawn(parse, true);
}
function handlePaste(e) {
    let str = e.clipboardData.getData("text");
    console.log("PASTING PATTERN");
    console.log(str);
    insertPattern(str);
    cubeCtrl.setCurveInAll(cubeCtrl.resetCurve);
}

// MARK: Init

let patternPick = "makerspace";
insertPattern(PATTERNS.patterns[patternPick]);
camera.position.set(PATTERNS.pattern_cameras[patternPick].x, PATTERNS.pattern_cameras[patternPick].y, PATTERNS.pattern_cameras[patternPick].z);
camera.lookAt(new THREE.Vector3(0,0,0));
cubeCtrl.enableHover(0.7, 8, 0.054, 13);
cubeCtrl.setCurveInAll(cubeCtrl.resetCurve);