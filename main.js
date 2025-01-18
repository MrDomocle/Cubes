import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { textureLoad } from 'three/tsl';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

var clock = new THREE.Clock();
var delta = 0;

var speed = 10;
var speed_curve = 2;

var target = new THREE.Quaternion(0, 1, 0, 0);

const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
const ambientLight = new THREE.AmbientLight();
scene.add(directionalLight);
scene.add(ambientLight);
directionalLight.position.set(5,10,5);

camera.position.z = 15;

// Define a cubic Bézier curve for transitions
const p0 = new THREE.Vector3(0, 0, 0);
const p1 = new THREE.Vector3(15, 25, 5);
const p2 = new THREE.Vector3(35, -15, -25);
const p3 = new THREE.Vector3(-25, -25, 0);

document.getElementById("speed").addEventListener("input", changeSpeed);
document.getElementById("speed_curve").addEventListener("input", changeSpeedCurve);
window.addEventListener("keydown", handleKeys);

// Individual cube class.
// Holds the cube mesh and all targets
class Cube {
    target_rotate;
    target_translate;
    target_curve;

    curve_t;
    curve_t_t;

    geometry;
    material;
    mesh;

    done_rotate;
    done_translate;
    done_curve;

    offset;
    index;

    constructor(pos, ofs, ix, quat = new THREE.Quaternion().identity()) {
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshStandardMaterial({color: 0x6545b2});

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

        scene.add(this.mesh);
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
    setCurve(p1,p2,end) {
        this.target_curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3().copy(this.mesh.position),
            new THREE.Vector3().copy(p1),
            new THREE.Vector3().copy(p2),
            new THREE.Vector3().copy(end)
        );
        this.done_curve = false;
        this.curve_t = 0;
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
            this.curve_t = Math.pow(speed, this.curve_t_t)-1;
            
            this.mesh.position.copy(this.target_curve.getPoint(this.curve_t));
            if (this.curve_t > 0.99) {
                this.done_curve = true;
                console.log("done");
            }
        } else if (!this.done_translate) {
            this.mesh.position.lerp(this.target_translate, speed*delta);
            if (this.mesh.position.distanceTo(this.target_translate) < 0.01) {
                this.done_translate = true;
            }
        }
        
    }
}

// Cube controller - each can be assigned Cube objects. Cubes should not be manipulated directly, but through a CubeController.
class CubeController {
    cubes;
    origin;
    waveActive;
    waveTarget;
    waveTime;
    waveLength;
    cubesX;
    cubesY;
    constructor() {
        this.cubes = new Array();
        this.origin = new THREE.Vector3(0,0,0);
        this.waveActive = false;
        this.cubesX = 0;
        this.cubesY = 0;
    }
    addCube(x,y, step) {
        this.cubes.push(new Cube(
            new THREE.Vector3(x*step,y*step,0),
            new THREE.Vector3(x*step,y*step,0),
            {x:x,y:y}
        ));
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

    setCurveAll(p1, p2, end) {
        for (let i = 0; i < this.cubes.length; i++) {
            setTimeout(() => {
                this.cubes[i].setCurve(p1, p2, end);
            }, Math.random()*200);
        }
    }

    swipeAll(mg, time) {
        let tg = new THREE.Vector3(-1,1,0).multiplyScalar(mg);
        let dir = new THREE.Vector3().subVectors(tg, this.origin).normalize();
        let rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
        this.waveTarget = rot;
        this.waveLength = time;
        this.waveTime = 0;
        this.waveActive = true;
    }

    updateAll() {
        if (this.waveActive) {
            this.waveTime += delta;
            this.waveActive = this.waveTime < this.waveLength;
            if (this.waveActive) {
                let step = Math.floor((this.cubesX+this.cubesY)*(this.waveTime/this.waveLength));
                
                let diagonal = step-this.cubesY+1;

                for (let i = 0; i < this.cubes.length; i++) {
                    if (this.cubes[i].index.y-this.cubes[i].index.x == diagonal) {
                        this.cubes[i].setRotTarget(this.waveTarget);
                    } else {
                        this.cubes[i].setRotTarget(new THREE.Quaternion().identity());
                    }
                }                
            }
        }
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].update();
        }
    }

    removeAll() {
        for (let i = 0; i < this.cubes.length; i++) {
            scene.remove(this.cubes[i].mesh);
        }
    }
}

let cubeCtrl = new CubeController();
function spawn() {
    let step = 1.1;
    cubeCtrl.cubesX = 6;
    cubeCtrl.cubesY = 6;
    for (let x = -3; x < 3; x++) {
        for (let y = -3; y < 3; y++) {
            cubeCtrl.addCube(x,y,step)
        }
    }
}
spawn();
controls.update();

function animate() {
    delta = clock.getDelta();
    cubeCtrl.updateAll();
    controls.update();

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
    if (e.key == "r") {
        cubeCtrl.setRotateAll(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/4, Math.PI/2, Math.PI/6)));
    }
    if (e.key == "t") {
        cubeCtrl.setTranslateAll(camera.position);
    }
    if (e.key == "y") {
        cubeCtrl.setTranslate(camera.position);
    }
    if (e.key == "c") {
        cubeCtrl.setCurveAll(new THREE.Vector3().copy(p1),new THREE.Vector3().copy(p2),new THREE.Vector3().copy(p3))
    }
    if (e.key == "j") {
        cubeCtrl.swipeAll(1000,1);
    }
    if (e.key == "x") {
        cubeCtrl.removeAll();
        spawn();
    }
}

function drawCurve() {
    const bezierCurve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

    // Test getPoint
    const t = 0.5; // Midpoint
    const point = bezierCurve.getPoint(t);

    // Visualize the curve
    const points = bezierCurve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const curveLine = new THREE.Line(geometry, material);

    scene.add(curveLine);
}
//drawCurve();