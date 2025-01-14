import * as THREE from 'three';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

var clock = new THREE.Clock();
var delta = 0;

var speed = 0;

var target = new THREE.Quaternion(0, 1, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x6545b2 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;
camera.rotation.x = -0.4;
camera.position.y = 2;

document.getElementById("speed").addEventListener("input", changeSpeed);
window.addEventListener("keydown", handleKeys);

function animate() {
    delta = clock.getDelta();
    cube.quaternion.slerp(target, speed);
    //console.log(delta);


	renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );

function changeSpeed(e) {
    console.log("set speed to "+e.target.value);
    speed = e.target.value;
}

function handleKeys() {

}