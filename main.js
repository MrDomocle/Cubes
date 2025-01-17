import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { textureLoad } from 'three/tsl';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

var clock = new THREE.Clock();
var delta = 0;

var speed = 0;

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

camera.position.z = 5;
camera.position.y = 5;

document.getElementById("speed").addEventListener("input", changeSpeed);
window.addEventListener("keydown", handleKeys);

// Individual cube class.
// Holds the cube mesh and all targets
class Cube {
    target_rotate;
    target_translate;
    target_curve;

    curve_t;

    geometry;
    material;
    mesh;

    done_rotate;
    done_translate;
    done_curve;

    offset;

    constructor(pos, ofs, quat = new THREE.Quaternion().identity()) {
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

        this.offset = new THREE.Vector3().copy(ofs);

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
        this.target_curve = new THREE.CubicBezierCurve3(this.mesh.position, p1, p2, end);
        this.done_curve = false;
    }

    isDoneRotate() {
        return this.done_rotate;
    }
    isDoneTranslate() {
        return this.done_translate;
    }

    update() {
        if (!this.done_rotate) {
            this.mesh.quaternion.slerp(this.target_rotate, speed*delta);
            if (this.mesh.quaternion.angleTo(this.target_rotate) < 0.01) {
                this.done_rotate = true;
            }
        }

        if (!this.done_curve) {
            curve_t += (1-curve_t)*speed*delta;
            this.mesh.position = this.target_curve.getPoint(curve_t);
            if (curve_t >= 1) {
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
    constructor() {
        this.cubes = new Array();
        this.origin = new THREE.Vector3(0,0,0);
    }
    addCube(cube) {
        this.cubes.push(cube);
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

    setTranslateAll(pos) {
        this.origin.copy(pos);
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setTranslateTargetRelative(pos);
        }
    }
    setTranslate(pos, i=0) {
        this.cubes[i].setTranslateTarget(pos);
    }

    setCurveAll(p1, p2, end) {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setCurve(p1, p2, end);
        }
    }

    updateAll() {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].update();
        }
    }
}

let cubeCtrl = new CubeController();
let step = 1.1;
for (let x = -3*step; x < 3*step; x += step) {
    for (let y = -3*step; y < 3*step; y += step) {
        cubeCtrl.addCube(new Cube(
            new THREE.Vector3(x,y,0),
            new THREE.Vector3(x,y,0)
        ));
    }
}
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
        cubeCtrl.setCurveAll();
    }
}