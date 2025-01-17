import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

var clock = new THREE.Clock();
var delta = 0;

var speed = 0;

var target = new THREE.Quaternion(0, 1, 0, 0);

const renderer = new THREE.WebGLRenderer();
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

class Cube {
    target_rotate;
    target_translate;
    geometry;
    material;
    mesh;
    constructor(x,y,z, quat = new THREE.Quaternion().identity(), quat_t = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0))) {
        this.target_rotate = quat_t;
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshStandardMaterial({color: 0x6545b2});

        this.mesh = new THREE.Mesh(this.geometry, this.material);

        this.mesh.position.set(x,y,z);
        this.mesh.rotation.setFromQuaternion(quat);

        this.target_translate = {x: x, y: y, z: z};
        this.target_rotate = quat_t;

        scene.add(this.mesh);
    }
    // Takes vector3 and sets target_rotation to look at it
    setLookTarget(tg) {
        let tg_v = new THREE.Vector3().subVectors(tg, this.mesh.position).normalize();
        this.target_rotate = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1).normalize(), tg_v)
        console.log(this.target_rotate);
        console.log(this.target_rotate, tg_v);
    }
    update() {
        //this.target_rotate = new Quaternion().
        this.mesh.quaternion.slerp(this.target_rotate, speed*delta);
    }
}
class CubeController {
    cubes;
    constructor() {
        this.cubes = new Array();
    }
    addCube(cube) {
        this.cubes.push(cube);
    }
    setLookAll(tg) {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].setLookTarget(tg);
        }
    }
    updateAll() {
        for (let i = 0; i < this.cubes.length; i++) {
            this.cubes[i].update();
        }
    }
}

let cubeCtrl = new CubeController();

for (let x = -3; x < 3; x++) {
    for (let y = -3; y < 3; y++) {
        cubeCtrl.addCube(new Cube(x,y,0));
    }
}
controls.update();
cubeCtrl.setLookAll(new THREE.Vector3(10, 10, 10));

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
    if (e.key == "r") {
        cubeCtrl.setLookAll(camera.position);
    }
}