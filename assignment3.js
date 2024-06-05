import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';
import { Text_Line } from './examples/text-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Texture, Scene,
} = tiny;

export class Assignment3 extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            paddle: new Shape_From_File("assets/10519_Pingpong_paddle_v1_L3.obj"),
            teapot: new Shape_From_File("assets/teapot.obj"),
            pingpong_table: new Shape_From_File("assets/10520_pingpongtable_L2.obj"),
            box: new defs.Cube(),  // Define a cube shape for the room
            floor: new defs.Cube(), // Define a cube shape for the floor
            barrier: new defs.Cube(), // Define a cube shape for the barriers
            pong_ball: new defs.Subdivision_Sphere(4),
        };

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            test2: new Material(new Gouraud_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            ring: new Material(new Ring_Shader()),
            paddle_texture_1: new Material(new defs.Phong_Shader(), {
                ambient: .3, diffusivity: .5, specularity: .5,
                color: hex_color("#0000FF")  // Blue paddle
            }),
            paddle_texture_2: new Material(new defs.Phong_Shader(), {
                ambient: .3, diffusivity: .5, specularity: .5,
                color: hex_color("#FF0000")  // Red paddle
            }),
            room: new Material(new defs.Phong_Shader(), {
                ambient: 1, diffusivity: .8, color: hex_color("#87CEEB")  // Light blue color for the room
            }),
            floor: new Material(new defs.Textured_Phong(1), {
                color: color(.5, .5, .5, 1),
                ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/floor.jpg")
            }),
            barrier: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, color: hex_color("#000080")  // Dark blue color for the barriers
            }),
            table: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, color: hex_color("#00BFFF")  // Blue color for the table
            }),
            pong_ball: new Material(new defs.Phong_Shader(), {
                color: hex_color("#F06400"), ambient: 1, diffusivity: 1,  specularity: 1
            }),
        }



        this.initial_camera_location = Mat4.look_at(
            vec3(0, 10, 20),
            vec3(0, 0, 0),
            vec3(0, 1, 0));

        this.paddle1_x = 0;
        this.paddle2_x = 0;
        this.paddle_speed = 3;
        this.swing_paddle_1 = false;  // Boolean to control the blue paddle swinging animation
        this.swing_progress_1 = 0;    // Variable to track the progress of the blue paddle swing
        this.swing_paddle_2 = false;  // Boolean to control the red paddle swinging animation
        this.swing_progress_2 = 0;    // Variable to track the progress of the red paddle swing
        this.moving_paddle1_left = false;
        this.moving_paddle1_right = false;
        this.moving_paddle2_left = false;
        this.moving_paddle2_right = false;

        // pong ball booleans denoting 4 phases of motion
        this.pong_loc1 = true;
        this.pong_loc2 = false;
        this.pong_loc3 = false;
        this.pong_loc4= false;

        // pong ball position
        this.pongY = 6.2;
        this.pongZ = 5;

        this.pongX = 0; // Current X position, will get this by interpolating through z position and similar triangles
        this.pongXLast = 0; // Last X position prior to collision, will use this to calculate current pongX
        this.pongXGoal = 0; // Stores goal x position after collision in loc2 or loc 4

        // pong ball timestamp; will use this timestamp and which motion phase ball is in to get position
        this.pong_timestamp = 0;

        // checks if game over
        this.in_bounds = true;

        // // pong ball z direction speed
        // this.z_speed = 7.5;
        //
        // // pong ball y direction speed / acceleration
        // this.y_speed =  0; // Speed in loc1
        // this.y_accel1 = -1.3; // Acceleration in y direction when ball is going downwards
        // this.y_accel2 = .6; // Acceleration in y direction when ball is going upwards

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Paddle 1 Left", ["c"], () => this.moving_paddle1_left = true, undefined, () => this.moving_paddle1_left = false);
        this.key_triggered_button("Paddle 1 Right", ["v"], () => this.moving_paddle1_right = true, undefined, () => this.moving_paddle1_right = false);
        this.key_triggered_button("Swing Paddle 1", ["b"], () => {
            if (!this.swing_paddle_1) {
                this.swing_paddle_1 = true;
                this.swing_progress_1 = 0;
            }
        });
        this.new_line();
        this.key_triggered_button("Paddle 2 Left", ["j"], () => this.moving_paddle2_left = true, undefined, () => this.moving_paddle2_left = false);
        this.key_triggered_button("Paddle 2 Right", ["k"], () => this.moving_paddle2_right = true, undefined, () => this.moving_paddle2_right = false);
        this.key_triggered_button("Swing Paddle 2", ["l"], () => {
            if (!this.swing_paddle_2) {
                this.swing_paddle_2 = true;
                this.swing_progress_2 = 0;
            }
        });
    }


    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }
    
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
    
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();
    
        // Set the light above the paddle
        const light_height = 20; // Adjust as needed
        const light_position = vec4(0, light_height, 0, 1);
        const light_color = color(1, 1, 1, 1); // White light
        const light_radius = 10; // Adjust the intensity
        program_state.lights = [new Light(light_position, light_color, 10 ** light_radius)];
    
        // Draw the room (a larger box) around the scene
        const room_transform = model_transform
            .times(Mat4.scale(30, 30, 30));
        this.shapes.box.draw(context, program_state, room_transform, this.materials.room);
    
        // Draw the floor underneath the ping pong table, raised to the table level
        const floor_transform = model_transform
            .times(Mat4.translation(0, 1, 0))
            .times(Mat4.scale(30, 0.1, 30));
        this.shapes.floor.draw(context, program_state, floor_transform, this.materials.floor);
    
        // Draw the ping pong table in the scene, upright and scaled up
        const table_transform = model_transform
            .times(Mat4.translation(0, 3, 0))
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(3, 3, 3));
        if (this.shapes.pingpong_table.ready) {
            this.shapes.pingpong_table.draw(context, program_state, table_transform, this.materials.table);
        }
    
        // Update paddle positions based on key presses and delta time
        if (this.moving_paddle1_left) this.paddle1_x -= this.paddle_speed * dt;
        if (this.moving_paddle1_right) this.paddle1_x += this.paddle_speed * dt;
        if (this.moving_paddle2_left) this.paddle2_x -= this.paddle_speed * dt;
        if (this.moving_paddle2_right) this.paddle2_x += this.paddle_speed * dt;
    
        // Paddle 1 swing animation logic
        if (this.swing_paddle_1) {
            this.swing_progress_1 += dt;
            if (this.swing_progress_1 >= .5) {
                this.swing_progress_1 = .5;
                this.swing_paddle_1 = false;
            }
        }
        const swing_angle_1 = Math.PI / 4 * Math.sin(2 * this.swing_progress_1 * Math.PI);
        // Draw the blue paddle on the left side of the table (short end) and closer
        let left_paddle_transform = model_transform
            .times(Mat4.translation(this.paddle1_x, 5, 5.5));
        // Apply the rotation to tilt the handle to the top right
        left_paddle_transform = left_paddle_transform
            .times(Mat4.rotation(-Math.PI / 4, 0, 0, 1));
        if (this.swing_paddle_1) {
            left_paddle_transform = left_paddle_transform
                .times(Mat4.translation(0, 0.5, 0)) // Move the pivot point to the handle
                .times(Mat4.rotation(swing_angle_1, 1, 0, 0)) // Rotate towards the table
                .times(Mat4.translation(0, -0.5, 0)); // Move the pivot point back
        }
        left_paddle_transform = left_paddle_transform
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(0.5, 0.5, 0.5));
        if (this.shapes.paddle.ready) {
            this.shapes.paddle.draw(context, program_state, left_paddle_transform, this.materials.paddle_texture_1);
        }

        // Paddle 2 swing animation logic
        if (this.swing_paddle_2) {
            this.swing_progress_2 += dt;
            if (this.swing_progress_2 >= .5) {
                this.swing_progress_2 = .5;
                this.swing_paddle_2 = false;
            }
        }
        const swing_angle_2 = Math.PI / 4 * Math.sin(2 * this.swing_progress_2 * Math.PI);
        // Draw the red paddle on the right side of the table (short end) and closer
        let right_paddle_transform = model_transform
            .times(Mat4.translation(this.paddle2_x, 5, -5.5));
        // Apply the rotation to tilt the handle to the top left
        right_paddle_transform = right_paddle_transform
            .times(Mat4.rotation(Math.PI / 4, 0, 0, 1));
        if (this.swing_paddle_2) {
            right_paddle_transform = right_paddle_transform
                .times(Mat4.translation(0, 0.5, 0)) // Move the pivot point to the handle
                .times(Mat4.rotation(-swing_angle_2, 1, 0, 0)) // Rotate towards the table
                .times(Mat4.translation(0, -0.5, 0)); // Move the pivot point back
        }
        right_paddle_transform = right_paddle_transform
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(0.5, 0.5, 0.5));
        if (this.shapes.paddle.ready) {
            this.shapes.paddle.draw(context, program_state, right_paddle_transform, this.materials.paddle_texture_2);
        }

        // Ball collision detection //

        // Out of bounds; game ends
        if ((this.pong_loc2 && this.pongZ < -8) || (this.pong_loc4 && this.pongZ > 8)){
            this.in_bounds = false;
        }

        // If z of ball is near 5, check for collision with paddle 1
        // If there is collision, pong now in phase 1
        if (this.pongZ > 4.95 && this.pongZ < 5.05 && this.pong_loc4 && Math.abs(this.pongX - this.paddle1_x) < .65) {

            // Swing paddle 1
            if (!this.swing_paddle_1) {
                this.swing_paddle_1 = true;
                this.swing_progress_1 = 0;
            }

            // Change movement phase and get timestamp of collision
            this.pong_timestamp = t;
            this.pong_loc4 = false;
            this.pong_loc1 = true;

            // Get new X position (will be from -1.8 to 1.8)
            this.pongXLast = this.pongXGoal;
            this.pongX = this.pongXGoal;
            this.pongXGoal = Math.random() * 3.6 - 1.8;
        }

        // If y of ball is near 4.2 (table edge height)
        // If pong_loc1 true, then pong_loc2 true
        // Else if pong_loc3 true, then pong_loc4 true
        if (this.pongY < 4.25){

            if (this.pong_loc1){
                this.pong_timestamp = t;
                this.pong_loc1 = false;
                this.pong_loc2 = true;
            }
            else if (this.pong_loc3){
                this.pong_timestamp = t;
                this.pong_loc3 = false;
                this.pong_loc4 = true;
            }
        }

        // If z of ball is near -5, check for collision with paddle 2
        // If there is collision, pong_loc3 true
        if (this.pongZ < -4.95 && this.pongZ > -5.05 && this.pong_loc2 && Math.abs(this.pongX - this.paddle2_x) < .65){

            // Swing paddle 2
            if (!this.swing_paddle_2) {
                this.swing_paddle_2 = true;
                this.swing_progress_2 = 0;
            }

            // Change movement phase and get timestamp of collision
            this.pong_timestamp = t;
            this.pong_loc2 = false;
            this.pong_loc3 = true;

            // Get new X position (will be from -1.8 to 1.8)
            this.pongXLast = this.pongXGoal;
            this.pongX = this.pongXGoal;
            this.pongXGoal = Math.random() * 3.6 - 1.8;
        }

        // Ball movement update //
        let delta_t = t - this.pong_timestamp;

        // Travels 3/4 of X and Z distance in 1 second
        if (this.pong_loc1){
            this.pongZ = (delta_t) * (-7.5) + 5;
            this.pongY = (6.2 - (4 * (delta_t) * (delta_t)));
            this.pongX = (delta_t) * ((.75)*(this.pongXGoal - this.pongXLast)) + this.pongXLast;
        }

        // y position same as phase 1, z is flipped
        else if (this.pong_loc3){
            this.pongZ = (delta_t) * 7.5 - 5;
            this.pongY = (6.2 - (4 * (delta_t) * (delta_t)));
            this.pongX = (delta_t) * ((.75)*(this.pongXGoal - this.pongXLast)) + this.pongXLast;
        }

        // Travels 1/4 of X and Z distance in .5 seconds; intercept is 3/4 of the distance to the other side
        else if (this.pong_loc2){
            this.pongZ = (delta_t) * (-5) - 2.5;
            this.pongY = (4.2 + 6 * delta_t - 8 * (delta_t) * (delta_t));
            this.pongX = (delta_t) * ((.5)*(this.pongXGoal - this.pongXLast))
                + this.pongXLast + ((.75) * (this.pongXGoal - this.pongXLast));
        }

        // y position same as phase 2, z is flipped
        else if (this.pong_loc4){
            this.pongZ = (delta_t) * (5) + 2.5;
            this.pongY = (4.2 + 6 * delta_t - 8 * (delta_t) * (delta_t));
            this.pongX = (delta_t) * ((.5)*(this.pongXGoal - this.pongXLast))
                + this.pongXLast + ((.75) * (this.pongXGoal - this.pongXLast));
        }

        // Draw ping pong ball in current location
        let pong_transform = Mat4.identity()
            .times(Mat4.translation(this.pongX, this.pongY, this.pongZ))
            .times(Mat4.scale(0.1429, 0.1429, 0.1429)); //7 Times smaller in each direction
        if (this.in_bounds){
            this.shapes.pong_ball.draw(context, program_state, pong_transform, this.materials.pong_ball);
        }


        // // dt position update method
        // // If z of ball is near 5, check for collision with paddle 1
        // // If there is collision, pong now in phase 1
        // if (this.pongZ > 4.95 && this.pongZ < 5.05 && this.pong_loc4){
        //     this.pong_loc4 = false;
        //     this.pong_loc1 = true;
        //     this.y_speed = 0;
        //     this.pongZ = 5;
        //     this.pongY = 5;
        // }
        //
        // // If y of ball is near 3 (table edge)
        // // If pong_loc1 true, then pong_loc2 true
        // // Else if pong_loc3 true, then pong_loc4 true
        // if (this.pongY < 3.02 ){
        //     if (this.pong_loc1){
        //         this.pong_loc1 = false;
        //         this.pong_loc2 = true;
        //         this.y_speed = 0;
        //         this.pongY = 3;
        //         this.pongZ = -2.5;
        //     }
        //     else if (this.pong_loc3){
        //         this.pong_loc3 = false;
        //         this.pong_loc4 = true;
        //         this.y_speed = 0;
        //         this.pongY = 3;
        //         this.pongZ = 2.5;
        //     }
        // }
        //
        // // If z of ball is near -5, check for collision with paddle 2
        // // If there is collision, pong_loc3 true
        // if (this.pongZ < -4.95 && this.pongZ > -5.05 && this.pong_loc2){
        //     this.pong_loc2 = false;
        //     this.pong_loc3 = true;
        //     this.y_speed = 0;
        //     this.pongZ = -5;
        //     this.pongY = 5;
        // }
        //
        // // Ping pong ball location changing based on which phase of motion
        // if (this.pong_loc1){
        //     this.pongZ -= this.z_speed * dt;
        //
        //     this.y_speed += this.y_accel1 * dt;
        //     this.pongY += this.y_speed * dt;
        // }
        // else if (this.pong_loc2){
        //     this.pongZ -= this.z_speed * dt;
        //
        //     this.y_speed += this.y_accel2 * dt;
        //     this.pongY += this.y_speed * dt;
        // }
        // else if (this.pong_loc3){
        //     this.pongZ += this.z_speed * dt;
        //
        //     this.y_speed += this.y_accel1 * dt;
        //     this.pongY += this.y_speed * dt;
        // }
        // else if (this.pong_loc4){
        //     this.pongZ += this.z_speed * dt;
        //
        //     this.y_speed += this.y_accel2 * dt;
        //     this.pongY += this.y_speed * dt;
        // }

    
        // Variables for barrier dimensions and positions
        const barrier_height = 1.5; // Half the height of the table
        const barrier_thickness = 0.1;
        const barrier_length = 4; // Length for both long and short sides
        const distance_from_table_long = 6; // Distance from table for long barriers
        const distance_from_table_short = 10; // Distance from table for short barriers
        const barrier_offset_long = 6; // Offset for long barriers from center
    
        // Left barriers on the long end of the table
        const left_long_barrier1_transform = model_transform
            .times(Mat4.translation(-distance_from_table_long, barrier_height, barrier_offset_long))
            .times(Mat4.scale(barrier_thickness, barrier_height, barrier_length));
        this.shapes.barrier.draw(context, program_state, left_long_barrier1_transform, this.materials.barrier);
    
        const left_long_barrier2_transform = model_transform
            .times(Mat4.translation(-distance_from_table_long, barrier_height, -barrier_offset_long))
            .times(Mat4.scale(barrier_thickness, barrier_height, barrier_length));
        this.shapes.barrier.draw(context, program_state, left_long_barrier2_transform, this.materials.barrier);
    
        // Right barriers on the long end of the table
        const right_long_barrier1_transform = model_transform
            .times(Mat4.translation(distance_from_table_long, barrier_height, barrier_offset_long))
            .times(Mat4.scale(barrier_thickness, barrier_height, barrier_length));
        this.shapes.barrier.draw(context, program_state, right_long_barrier1_transform, this.materials.barrier);
    
        const right_long_barrier2_transform = model_transform
            .times(Mat4.translation(distance_from_table_long, barrier_height, -barrier_offset_long))
            .times(Mat4.scale(barrier_thickness, barrier_height, barrier_length));
        this.shapes.barrier.draw(context, program_state, right_long_barrier2_transform, this.materials.barrier);
    
        // Front barrier on the short end of the table
        const front_barrier_transform = model_transform
            .times(Mat4.translation(0, barrier_height, distance_from_table_short))
            .times(Mat4.scale(barrier_length, barrier_height, barrier_thickness));
        this.shapes.barrier.draw(context, program_state, front_barrier_transform, this.materials.barrier);
    
        // Back barrier on the short end of the table
        const back_barrier_transform = model_transform
            .times(Mat4.translation(0, barrier_height, -distance_from_table_short))
            .times(Mat4.scale(barrier_length, barrier_height, barrier_thickness));
        this.shapes.barrier.draw(context, program_state, back_barrier_transform, this.materials.barrier);
    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template
    // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 VERTEX_COLOR;
        
        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                
                VERTEX_COLOR = vec4( shape_color.xyz * ambient, shape_color.w );
                VERTEX_COLOR.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main() {
                gl_FragColor = VERTEX_COLOR;
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main() {
            center = model_transform * vec4(0, 0, 0, 1);
            point_position = model_transform * vec4(position, 1);
            gl_Position = projection_camera_model_transform * vec4(position, 1);
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        void main() {
            float distance_from_center = distance(point_position.xyz, center.xyz);
            float brightness = 0.5 + 0.5 * sin(20.0 * distance_from_center);
            vec4 ring_color = vec4(0.69, 0.50, 0.25, 1.0) * brightness; // Muddy brown-orange color components
            gl_FragColor = ring_color;
        }`;
    }
}

