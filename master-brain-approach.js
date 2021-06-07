// Current tasks:
// come up with a way to attack efficiently
//  -> everyone shouldn't target the same enemy at the same time
//  -> calculate spendable energy and enemy's energy to know optimally how many spirits should attack
//    -> also calculate distances to spread the fire as effectively as possible
//  -> maybe they shouldn't stop moving and should not pulse fire
//    -> my guys are getting decimated in combat
//  -> when it's time to attack enemy base, wait until everyone is charged and grouped up
//
// Next up:
// better defense
//  -> base needs beefed up guard spirits (>50 energy)

// for console
// memory = [];
// my_spirits = [];
// star_zxq = {id: 'star_zxq', position: [0, 0]};
// base = {id: 'base'};


// How many total spirits are needed before we start an attack
var required_spirits_to_start_attack = 100;
var required_spirits_to_continue_attack = 10;
// Number of spirits to remain harvesting in attack mode
var spirits_to_harvest_during_attack = 0;
// Size we want spirits to be (via merge). Set to 0 to disable merging.
var spirit_target_size = 0;
// Without limiting merges, we can get "merge storms" where spirits get bigger than desired
var max_merges_per_tick = 5;
var star_to_harvest = star_a1c;

var play_modes_enum = { idle: 0, harvest: 1, defend: 2, attack: 3 };
var behaviors_enum = { idling: 0, harvesting: 1, charging: 2, attacking: 3, merging: 4 };
var states_enum = { mode: 99999 };

var alive_spirits = [];


function init() {
  set_alive_spirits();
  init_spirits_memory();

  // Harvest mode by default
  if (memory[states_enum.mode] == null) {
    memory[states_enum.mode] = play_modes_enum.harvest;
  }
}

// Returns an array of the spirits which are currently alive
function set_alive_spirits() {
  if (alive_spirits.length == 0) {
    for (var i = 0; i < my_spirits.length; i++) {
      if (my_spirits[i].hp != 0) {
        alive_spirits.push(my_spirits[i]);
      }
      // else if (memory[my_spirits[i].id] != null) {
      //   // Keep the memory object from becoming huge by deleting memory for dead spirits
      //   console.log("Cleaning memory for dead spirit " + my_spirits[i].id);
      //   memory[my_spirits[i].id] = null;
      // }
    }
  }
  return(alive_spirits);
}

function init_spirits_memory() {
  for (var i = 0; i < my_spirits.length; i++) {
    if (memory[my_spirits[i].id] == null) {
      spirit_reset(my_spirits[i]);
    }
  }
}

function spirit_reset(spirit) {
  memory[spirit.id] = {
    // Initial / default behavior given to new / reset spirits
    default_behavior: { behavior_mode: behaviors_enum.harvesting, target: star_to_harvest },

    // keep track of energy changes
    last_energy: 0,

    // keep track of what to return to when tasks complete
    behavior_stack: [],

    // all-purpose message queue
    message_queue: [],

    // current behavior_mode
    get behavior_mode() {
      this._fix_empty_behavior_stack();
      return(this.behavior_stack[0].behavior_mode);
    },
    set behavior_mode(val) { // REPLACES current behavior
      this._fix_empty_behavior_stack();
      this.behavior_stack[0].behavior_mode = val;
    },

    // current target
    get target() {
      this._fix_empty_behavior_stack();
      return(this.behavior_stack[0].target);
    },
    set target(val) { // REPLACES current target
      this._fix_empty_behavior_stack();
      this.behavior_stack[0].target = val;
    },

    // is_behavior_queued: function(behavior) {
    //   return(this.behavior_stack.some(
    //     function f(element) {
    //       return(element.behavior_mode == this);
    //     }, behavior
    //   ));
    // },

    // Adds new behavior as the first item in the stack
    push_behavior: function(behavior) {
      return(this.behavior_stack.unshift(behavior));
    },

    // Removes the current behavior
    pop_behavior: function(behavior) {
      return(this.behavior_stack.shift());
    },

    set_base_behavior: function(behavior) {
      this.behavior_stack[this.behavior_stack.length - 1] = behavior;
    },

    _fix_empty_behavior_stack: function() {
      if (this.behavior_stack.length == 0) {
        this.behavior_stack = [this.default_behavior];
      }
    },
  };
  memory[spirit.id].push_behavior(memory[spirit.id].default_behavior);
  memory[spirit.id].last_energy = spirit.energy;
}

// Sets / changes the given spirit's base target and behavior
function set_base_behavior(spirit, target, behavior) {
  console.log("set_base_behavior: " + spirit.id + ", " + behavior + ", target: " + ((target == null) ? "null" : target.id));
  memory[spirit.id].set_base_behavior({ behavior_mode: behavior, target: target });
}

// Executes or continues the spirit's behavior
function execute_behavior(spirit) {
  // if (spirit.executed_behavior) {
  //   console.log("skipping executed behavior: " + spirit.id + ", existing behavior: " + spirit.behavior_mode + ", attempted behavior: " + behavior);
  //   return;
  // }
  var behavior = memory[spirit.id].behavior_mode;
  var target = memory[spirit.id].target;
  if (behavior == behaviors_enum.charging) {
    move_if_energy_unchanged(spirit, target.position);
    spirit.energize(target);
  } else if (behavior == behaviors_enum.attacking) {
    spirit.move(target.position);
    spirit.energize(target);
  } else if (behavior == behaviors_enum.harvesting) {
    move_if_energy_unchanged(spirit, target.position);
    spirit.energize(spirit);
  } else if (behavior == behaviors_enum.merging) {
    spirit.move(target.position);
    spirit.merge(target);
  }
  // spirit.executed_behavior = true;
}

function push_behavior(spirit, target, behavior) {
  // Do not requeue the current item
  if (behavior == memory[spirit.id].behavior_mode && target == memory[spirit.id].target) {
    return;
  }
  console.log("push_behavior: " + spirit.id + ", " + behavior + ", target: " + ((target == null) ? "null" : target.id));
  memory[spirit.id].push_behavior({ behavior_mode: behavior, target: target });
}

function pop_behavior(spirit) {
  console.log("pop_behavior: " + spirit.id);
  var popped = memory[spirit.id].pop_behavior();
  return(popped);
}

function update_energy_memory() {
  for(i = 0; i < alive_spirits.length; i++) {
    memory[alive_spirits[i].id].last_energy = alive_spirits[i].energy;
  }
}

// Makes attacking, harvesting, and charging more efficient by staying still if movement is unnecessary.
function move_if_energy_unchanged(spirit, position) {
  if (memory[spirit.id].last_energy == spirit.energy) {
    spirit.move(position);
  }
}

// Returns the object in the array closet to the source position
function closest_object(source_position, objects_array) {
  if (objects_array.length == 0) {
    return(null);
  }
  if (objects_array.length == 1) {
    return(objects_array[0]);
  }
  var object_distances = [];
  for (var i = 0; i < objects_array.length; i++) {
    object_distances[i] = calculate_distance(source_position, objects_array[i].position);
    objects_array[i].calculated_distance = object_distances[i];
  }
  // console.log("object_distances: " + object_distances);
  var sorted_objects_array = objects_array.sort((x, y) => y.calculated_distance - x.calculated_distance);
  var closest = sorted_objects_array[0];
  // console.log("Of calculated distances " + object_distances + ", the closest object is " + closest);
  return(closest);
}

function calculate_distance(pos_a, pos_b) {
  // console.log("Calculating distance for [" + pos_a + "] and [" + pos_b + "]");
  if (pos_a == null || pos_b == null) {
    return(999999);
  }
  var a = pos_a[0] - pos_b[0];
  var b = pos_a[1] - pos_b[1];
  var distance = Math.sqrt(a * a + b * b);
  // console.log("Calculated distance for [" + pos_a + "] and [" + pos_b + "] is " + distance);
  return(distance);
}

// Defend base with all we've got regardless of existing game mode
function defend_attack() {
  if (base.sight.enemies.length > 0) {
    console.log("Base is under attack!");
    memory[states_enum.mode] = play_modes_enum.defend;
    var enemies = base.sight.enemies.map(x => spirits[x]);
    var invader_to_attack = closest_object(base.position, enemies);

    for (var i = 0; i < alive_spirits.length; i++) {
      if (alive_spirits[i].energy >= 10) {
        push_behavior(alive_spirits[i], invader_to_attack, behaviors_enum.attacking);
        console.log(alive_spirits[i].id + " defending base against " + invader_to_attack.id + " at position " + invader_to_attack.position);
      } else if (alive_spirits[i].energy == 0) {
        while (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.attacking) {
          pop_behavior(alive_spirits[i]);
        }
      }
    }
  } else if (memory[states_enum.mode] == play_modes_enum.defend) {
    memory[states_enum.mode] = play_modes_enum.harvest;
    for (var i = 0; i < alive_spirits.length; i++) {
      while (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.attacking) {
        pop_behavior(alive_spirits[i]);
      }
    }
  }
}

// TODO: This will interfere with attack mode - spirits will attack all the surrounding enemy spirits first
//  --> observed behavior is that some spirits attack enemies and others attack the base. This is ok for now.
function attack_visible_enemies() {
  for (var i = 0; i < alive_spirits.length; i++) {
    if (alive_spirits[i].energy >= 10 && alive_spirits[i].sight.enemies.length > 0) {
      var enemies = alive_spirits[i].sight.enemies.map(x => spirits[x]);
      var enemy_to_attack = closest_object(alive_spirits[i].position, enemies);
      push_behavior(alive_spirits[i], enemy_to_attack, behaviors_enum.attacking);
      console.log(alive_spirits[i].id + " attacking visible enemy " + enemy_to_attack.id + " at position " + enemy_to_attack.position);
    } else {
      while (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.attacking) {
        pop_behavior(alive_spirits[i]);
      }
    }
  }
}

function harvest() {
  if (memory[states_enum.mode] == play_modes_enum.harvest) {
    for (var i = 0; i < alive_spirits.length; i++) {
      if (!alive_spirits[i].executed_behavior) {
        if (memory[states_enum.mode] == play_modes_enum.harvest) {
          if (alive_spirits[i].energy == alive_spirits[i].energy_capacity) {
            set_base_behavior(alive_spirits[i], base, behaviors_enum.charging);
          } else if (alive_spirits[i].energy == 0 || memory[alive_spirits[i].id] == null) {
            set_base_behavior(alive_spirits[i], star_to_harvest, behaviors_enum.harvesting);
          }
        }
      }
    }
  }
}

function merge() {
  if (spirit_target_size > 0) {
    var merge_counter = 0;
    for (var i = 0; i < alive_spirits.length && merge_counter < max_merges_per_tick; i++) {
      if (alive_spirits[i].size < spirit_target_size) {
        // Build array of visible spirits which have not yet reached the target size
        var possible_merge_max_size = spirit_target_size - alive_spirits[i].size;
        var possible_merges = alive_spirits[i].sight.friends.map(x => spirits[x]).filter(x => x.size <= possible_merge_max_size);
        if (possible_merges.length > 0) {
          var merge_with = closest_object(alive_spirits[i].position, possible_merges);
          console.log(alive_spirits[i].id + " wants to merge with " + merge_with.id);
          push_behavior(alive_spirits[i], merge_with, behaviors_enum.merging);
          merge_counter += 1;
        } else {
          while (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.merging) {
            pop_behavior(alive_spirits[i]);
          }
        }
      } else {
        while (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.merging) {
          pop_behavior(alive_spirits[i]);
        }
      }
    }
  }
}

function attack_enemy_base() {
  // Attack once we have at least `required_spirits_to_start_attack` spirits
  if (alive_spirits.length >= required_spirits_to_start_attack) {
    memory[states_enum.mode] = play_modes_enum.attack;
  }
  if (memory[states_enum.mode] == play_modes_enum.attack) {
    // Stop attacking if we drop below `required_spirits_to_continue_attack` spirits
    if (alive_spirits.length < required_spirits_to_continue_attack) {
      memory[states_enum.mode] = play_modes_enum.harvest;
      for (var i = 0; i < alive_spirits.length; i++) {
        if (memory[alive_spirits[i].id].behavior_mode == behaviors_enum.attacking) {
          spirit_reset(alive_spirits[i]);
        }
      }
    } else {
      for (var i = 0; i < alive_spirits.length; i++) {
        if (alive_spirits[i].energy >= 10) {
          set_base_behavior(alive_spirits[i], enemy_base, behaviors_enum.attacking);
        } else if (alive_spirits[i].energy == 0) {
          set_base_behavior(alive_spirits[i], star_to_harvest, behaviors_enum.harvesting);
        }
      }
    }
  }
}

// Logic:
// *** Higher items override lower items. For instance, in attack mode,
//     if a spirit sees an enemy spirit, it will attack that first.
// 1. Defend base
// 2. Spirits attack visible enemies
// 3. Merge spirits if desired
// 4. Harvest until attack condition met
// 5. Attack enemy base
function main() {
  attack_visible_enemies();
  defend_attack();
  merge();
  harvest();
  attack_enemy_base();

  for (var i = 0; i < alive_spirits.length; i++) {
    execute_behavior(alive_spirits[i]);
  }

  update_energy_memory();

  // console.log("queues: " + alive_spirits.map(x => x.id + ": " + memory[x.id].behavior_stack.length).join(", "));
  for(var i = 0; i < alive_spirits.length; i++) {
    if (memory[alive_spirits[i].id].behavior_stack.length > 1) {
      console.log("queue for " + alive_spirits[i].id + ":");
      for (var j = 0; j < memory[alive_spirits[i].id].behavior_stack.length; j++) {
        console.log("  behavior_mode: " + memory[alive_spirits[i].id].behavior_stack[j].behavior_mode + ", target: " + ((memory[alive_spirits[i].id].behavior_stack[j].target == null) ? "null" : memory[alive_spirits[i].id].behavior_stack[j].target.id));
      }
    }
  }
}

init();
main();


