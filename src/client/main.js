/*jshint browser:true*/

/*global $: false */
/*global TurbulenzEngine: true */
/*global Draw2D: false */
/*global Draw2DSprite: false */
/*global RequestHandler: false */
/*global TextureManager: false */
/*global Camera: false */

TurbulenzEngine.onload = function onloadFn()
{
  var intervalID;
  var graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
  var mathDevice = TurbulenzEngine.createMathDevice({});
  var draw2D = Draw2D.create({ graphicsDevice });
  var requestHandler = RequestHandler.create({});
  var textureManager = TextureManager.create(graphicsDevice, requestHandler);
  var inputDevice = TurbulenzEngine.createInputDevice({});
  var input = require('./input.js').create(inputDevice, draw2D);

  var soundDeviceParameters = {
    linearDistance : false
  };
  var soundDevice = TurbulenzEngine.createSoundDevice(soundDeviceParameters);
  var camera = Camera.create(mathDevice);
  var lookAtPosition = mathDevice.v3Build(0.0, 0.0, 0.0);
  var worldUp = mathDevice.v3BuildYAxis();
  var cameraPosition = mathDevice.v3Build(0.0, 0.0, 1.0);
  camera.lookAt(lookAtPosition, worldUp, cameraPosition);
  camera.updateViewMatrix();
  soundDevice.listenerTransform = camera.matrix;
  var sound_source_left = soundDevice.createSource({
      position : mathDevice.v3Build(-1, 0, 0),
      relative : false,
      pitch : 1.0,
  });
  var sound_source_right = soundDevice.createSource({
      position : mathDevice.v3Build(1, 0, 0),
      relative : false,
      pitch : 1.0,
  });

  var sounds = {};
  function loadSound(base) {
    var src = 'sounds/' + base;
    if (soundDevice.isSupported('FILEFORMAT_WAV')) {
      src += '.wav';
    } else {
      src += '.ogg';
    }
    soundDevice.createSound({
      src: src,
      onload: function (sound) {
        if (sound) {
          sounds[base] = sound;
        }
      }
    });
  }
  loadSound('good');
  loadSound('bad');

  var textures = {};
  function loadTexture(texname) {
    var path = texname;
    if (texname.indexOf('.') !== -1) {
      path = 'img/'+ texname;
    }
    var inst = textureManager.getInstance(path);
    if (inst) {
      return inst;
    }
    textures[texname] = textureManager.load(path, false);
    return textureManager.getInstance(path);
  }
  function createSprite(texname, params) {
    var tex_inst = loadTexture(texname);
    params.texture = tex_inst.getTexture();
    var sprite = Draw2DSprite.create(params);
    tex_inst.subscribeTextureChanged(function () {
      sprite.setTexture(tex_inst.getTexture());
    });
    return sprite;
  }
  // Viewport for Draw2D.
  var game_width = 1280;
  var game_height = 960;
  var color_white = mathDevice.v4Build(1, 1, 1, 1);
  var color_red = mathDevice.v4Build(1, 0, 0, 1);
  var color_yellow = mathDevice.v4Build(1, 1, 0, 1);
  var color_black = mathDevice.v4Build(0, 0, 0, 1);
  var color_green = mathDevice.v4Build(0, 1, 0, 1);
  var color_turf_good = mathDevice.v4Build(0, 1, 0, 1);
  var color_turf_bad = mathDevice.v4Build(0.5, 0.4, 0, 1);

  // Cache keyCodes
  var keyCodes = inputDevice.keyCodes;
  var padCodes = input.padCodes;

  var viewport = mathDevice.v4Build(0, 0, game_width, game_height);
  var configureParams = {
    scaleMode : 'scale',
    viewportRectangle : viewport
  };

  var game_state;


  var players = [];
  var players_changed = true;

  var input_devices = [];
  function addInputDevice(func, left_label, right_label) {
    func.label_left = left_label;
    func.label_right = right_label;
    input_devices.push(func);
  }
  addInputDevice(function () {
    return (input.isKeyDown(keyCodes.A) ? 1 : 0) +
      (input.isKeyDown(keyCodes.D) ? 2 : 0);
  }, 'A', 'D');
  addInputDevice(function () {
    return (input.isKeyDown(keyCodes.LEFT) ? 1 : 0) +
      (input.isKeyDown(keyCodes.RIGHT) ? 2 : 0);
  }, 'Left', 'Right');
  addInputDevice(function () {
    return (input.isPadButtonDown(0, padCodes.LEFT_SHOULDER) ? 1 : 0) +
      (input.isPadButtonDown(0, padCodes.RIGHT_SHOULDER) ? 2 : 0);
  }, 'LB', 'RB');
  addInputDevice(function () {
    return (input.isPadButtonDown(1, padCodes.LEFT_SHOULDER) ? 1 : 0) +
      (input.isPadButtonDown(1, padCodes.RIGHT_SHOULDER) ? 2 : 0);
  }, 'LB', 'RB');
  addInputDevice(function () {
    return (input.isPadButtonDown(2, padCodes.LEFT_SHOULDER) ? 1 : 0) +
      (input.isPadButtonDown(2, padCodes.RIGHT_SHOULDER) ? 2 : 0);
  }, 'LB', 'RB');
  addInputDevice(function () {
    return (input.isPadButtonDown(3, padCodes.LEFT_SHOULDER) ? 1 : 0) +
      (input.isPadButtonDown(3, padCodes.RIGHT_SHOULDER) ? 2 : 0);
  }, 'LB', 'RB');

  var ready_countdown;
  function choosePlayerInit() {
    if (!'donotcheckin') {
      players.push({
        ready: true,
        input_idx: 0,
      });
      // players.push({
      //   ready: true,
      //   input_idx: 1,
      // });
      game_state = playInit;
      return;
    }
    $('.screen').hide();
    $('#choosePlayer').show();
    ready_countdown = null;
    game_state = choosePlayer;
  }

  function choosePlayer(dt) {
    var ready_count = 0;
    input_devices.forEach(function (func, idx) {
      var player = null;
      players.forEach(function (check_player) {
        if (check_player.input_idx === idx) {
          player = check_player;
        }
      });
      var state = func();
      if (player === null) {
        // check for new player
        if (state) {
          players.push({
            ready: false,
            input_idx: idx,
          });
          players_changed = true;
        }
      } else {
        // toggle ready
        if (state & 1) {
          player.ready = false;
          players_changed = true;
        }
        if (state & 2) {
          player.ready = true;
          players_changed = true;
        }
        ready_count += player.ready ? 1 : 0;
      }
    });
    if (ready_count && ready_count === players.length) {
      if (ready_countdown === null) {
        // start it
        // TODO: up this back up to 3000
        ready_countdown = 3000;
      } else {
        // dec, maybe finish
        ready_countdown -= dt;
        if (ready_countdown < 0) {
          ready_countdown = 0;
          game_state = playInit;
        }
      }
      $('#ready').html('All players ready<br/><br/>Game starting in ' + (ready_countdown / 1000).toFixed(1) + 's...');
    } else if (!players.length) {
      $('#ready').html('');
    } else {
      ready_countdown = null;
      $('#ready').html('Game will begin after all players are ready');
    }
    if (players_changed) {
      players_changed = false;
      var html = [];
      players.forEach(function (player, idx) {
        var input_device = input_devices[player.input_idx];
        html.push('<div class="player">',
          ['Player ' + (idx + 1) + (player.ready ? '' : ' NOT') + ' ready!',
          '',
          input_device.label_left + ' - Unready',
          input_device.label_right + ' - Ready',
          ].join('<br/>'),
          '</div>');
      });
      html.push('<div class="player">',
        [
          'Player ' + (players.length + 1),
          '',
          'Enter with one of:',
          // TODO: Dynamic list
          '<code>A/D</code>',
          '<code>Left/Right</code>',
          '<code>Gamepad LB/RB</code>'].join('<br/>'),
        '</div>');
      $('#players').html(html.join('\n'));
    }
    //test();
  }

  var level_state_orig;
  var level_params;
  var num_levels = 6; // donotcheckin 6
  function initLevelState(level_idx) {
    level_params = {
      length: 7500,
      max_len: 300,
      min_len: 60,
      speed: 0.25,
      speed_scale_right: 1,
      hints: false,
      transform: function (x) {
        return x;
      }
    };
    switch (level_idx) {
      case 0:
        // tutorial, just one side
        level_params.speed_scale_right = 0;
        level_params.length = 100000; // donotcheckin 5000;
        level_params.hints = true;
        break;
      case 1:
        // default
        break;
      case 2:
        // fast
        level_params.length = 22500;
        level_params.speed = 0.65;
        level_params.min_len = 100;
        level_params.max_len = 400;
        break;
      case 3:
        // different speeds
        level_params.length = 10000,
        level_params.speed_scale_right = 0.5;
        break;
      case 4:
        // reverse!
        level_params.length = 10000,
        level_params.speed_scale_right = -1;
        break;
      case 5:
        // warp!
        level_params.transform = function (x) {
          var sign = x < 0 ? -1 : 1;
          x = Math.abs(x);
          return sign * Math.pow(x/2, 1.3);
        };
        level_params.length = 7500;
        break;
    }
    function getSideState(is_right) {
      var level_len = level_params.length;
      if (is_right) {
        level_len *= Math.abs(level_params.speed_scale_right);
      }
      let state = new Uint8Array(level_len);
      let pos = 0;
      let bit = 1;
      while (pos < level_len) {
        let len = Math.floor(Math.random() * (level_params.max_len - level_params.min_len)) + level_params.min_len;
        if (level_idx === 0) {
          if (pos === 0) {
            len = 300;
          } else if (pos === 300) {
            len = 400;
          }
        }
        while (len && pos < level_len) {
          state[pos] = bit;
          ++pos;
          --len;
        }
        bit = 1 - bit;
      }
      return state;
    }
    level_state_orig = [getSideState(false), getSideState(true)];
  }
  function getLevelState() {
    return [level_state_orig[0].slice(0), level_state_orig[1].slice(0)];
  }

  var bar_width = 128;
  var bar_pad = 2;
  var lane_width;
  var turf_good_left;
  var turf_bad_left;
  var turf_good_right;
  var turf_bad_right;
  var current_level = 0;
  var hint_shown = [];
  function playInit(dt) {
    $('.screen').hide();
    $('#play').show();
    hint_shown = [];
    $('#hints').html(players.map(function (p, idx) {
      var pad = '<div class="hint_pad fluid">&nbsp;</div>';
      var text = '<div id="hint' + idx + '" class="hint_text fluid"></div>';
      if (idx % 2) {
        return text + pad;
      }
      return pad + text;
    }).join(''));
    var eff_players = Math.max(players.length, 1.5);
    lane_width = game_width / eff_players;
    players.forEach(function (player, idx) {
      var spriteSize = 256;
      var x = lane_width * idx + lane_width/2;
      var y = game_height / 2;
      player.sprite = createSprite('cloud.png', {
        width : spriteSize,
        height : spriteSize,
        x,
        y: y - 20,
        rotation : 0,
        color : color_white,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
      var beam_width = lane_width / 2;
      player.beam_left = createSprite('beam.png', {
        width : 32,
        height : beam_width,
        x : x - beam_width/2,
        y,
        rotation : Math.PI/2,
        color : color_white,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
      player.beam_right = createSprite('beam.png', {
        width : 32,
        height : beam_width,
        x : x + beam_width/2,
        y,
        rotation : Math.PI/2,
        color : color_white,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
      player.bar_bg = createSprite('white', {
        width: bar_width,
        height: 28,
        x: x - bar_width/2,
        y,
        color: color_black,
        textureRectangle : mathDevice.v4Build(0, 0, 2, 2),
        origin: [0,0],
      });
      player.bar_fg = createSprite('white', {
        width: bar_width - bar_pad * 2,
        height: 28 - bar_pad * 2,
        x: x - bar_width/2 + bar_pad,
        y: y + bar_pad,
        color: color_green,
        textureRectangle : mathDevice.v4Build(0, 0, 2, 2),
        origin: [0,0],
      });
      player.cumulative = [];
    });
    if (!turf_good_left) {
      let spriteSize = 256;
      let width = spriteSize;
      let height = game_width / eff_players / 4;
      turf_good_left = createSprite('turf_good.png', {
        width,
        height,
        x: 0,
        y: 0,
        rotation : Math.PI/2,
        color : color_turf_good,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize),
        origin: [width, height],
      });
      turf_bad_left = createSprite('turf_bad.png', {
        width,
        height,
        x: 0,
        y: 0,
        rotation : Math.PI/2,
        color : color_turf_bad,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize),
        origin: [width, height],
      });
      turf_good_right = createSprite('turf_good.png', {
        width,
        height,
        x: 0,
        y: 0,
        rotation : -Math.PI/2,
        color : color_turf_good,
        textureRectangle : mathDevice.v4Build(spriteSize, 0, 0, spriteSize),
        origin: [0,height],
      });
      turf_bad_right = createSprite('turf_bad.png', {
        width,
        height,
        x: 0,
        y: 0,
        rotation : -Math.PI/2,
        color : color_turf_bad,
        textureRectangle : mathDevice.v4Build(spriteSize, 0, 0, spriteSize),
        origin: [0,height],
      });
    }
    current_level = 0;
    game_state = newLevelInit;
    newLevelInit(dt);
  }

  function newLevelInit(dt) {
    $('.screen').hide();
    $('#play').show();
    initLevelState(current_level);
    players.forEach(function (player, idx) {
      var pos0 = current_level === 0 ? -500 : -350;
      player.pos = pos0;
      player.pos_right = pos0;
      player.pos_offset = 0;
      player.new_pos_offset = 0;
      if (level_params.speed_scale_right < 0) {
        player.pos_right = level_state_orig[1].length + 350;
      }
      player.good = 0;
      player.possible = 0;
      player.level_state = getLevelState();
      player.miss_streak = 0;
      player.bad_hit_streak = 0;
      if (idx % 2) {
        let t = player.level_state[0];
        player.level_state[0] = player.level_state[1];
        player.level_state[1] = t;
        t = player.pos;
        player.pos = player.pos_right;
        player.pos_right = t;
      }
    });
    game_state = play;
    play(dt);
  }

  var padding = 100;
  var end_delay_px = 250;
  function play(dt) {
    var any_not_done = false;
    // determine appropriate positional offsets
    var min_score=1;
    var max_score=0;
    var avg_score=0;
    players.forEach(function (player) {
      var s = (player.good + 500) / (player.possible + 1000);
      avg_score += s;
      min_score = Math.min(min_score, s);
      max_score = Math.max(max_score, s);
    });
    avg_score /= players.length;
    players.forEach(function (player) {
      var s = (player.good + 500) / (player.possible + 1000);
      player.new_pos_offset = (s - avg_score) * game_height * 0.75;
    });

    players.forEach(function (player, idx) {
      var speed_scale_left = 1;
      var speed_scale_right = level_params.speed_scale_right;
      if (idx % 2) {
        speed_scale_left = level_params.speed_scale_right;
        speed_scale_right = 1;
      }
      var x0 = lane_width * idx;
      var x1 = lane_width * (idx + 1);
      var input_device = input_devices[player.input_idx];
      var state = input_device();
      var last_left_pos = Math.floor(player.pos) + 1;
      var last_right_pos = Math.floor(player.pos_right) + 1;
      player.pos += dt * level_params.speed * speed_scale_left;
      player.pos_right += dt * level_params.speed * speed_scale_right;
      if (player.new_pos_offset !== player.pos_offset) {
        player.pos += player.new_pos_offset - player.pos_offset;
        player.pos_right += player.new_pos_offset - player.pos_offset;
        player.pos_offset = player.new_pos_offset;
      }
      var this_left_pos = Math.floor(player.pos);
      var this_right_pos = Math.floor(player.pos_right);

      const TILE_DIST = 256;
      const max_len = 10;
      let y0 = game_height/2 - player.pos_offset;
      let y0_warp = game_height/2 + player.pos_offset;

      player.sprite.y = y0 - 20;
      player.beam_left.y = y0;
      player.beam_right.y = y0;
      player.bar_bg.y = y0;
      player.bar_fg.y = y0 + bar_pad;

      function drawTiledSpriteLeft(sprite, x, y, u, w) {
        u = u / TILE_DIST;
        var iu = Math.floor(u);
        var du = w / TILE_DIST;
        var u0 = u - iu;
        var u1 = u + du - iu;
        let y0_trans = level_params.transform(y - y0_warp) + y0_warp;
        let y1_trans = level_params.transform((y + w) - y0_warp) + y0_warp;
        if (u1 > 1) {
          var frac0 = (1 - u0) / du;
          let ymid_trans = level_params.transform((y + frac0 * w) - y0_warp) + y0_warp;
          sprite.x = x;
          sprite.y = game_height - y0_trans;
          sprite.setWidth(ymid_trans - y0_trans);
          sprite.setTextureRectangle([0, 0, (1-u0)*sprite.getTexture().width, 256]);
          draw2D.drawSprite(sprite);
          sprite.x = x;
          sprite.y = game_height - ymid_trans;
          sprite.setWidth(y1_trans - ymid_trans);
          sprite.setTextureRectangle([(1 - (u1 - 1))*sprite.getTexture().width, 0, sprite.getTexture().width, 256]);
          draw2D.drawSprite(sprite);
        } else {
          sprite.x = x;
          sprite.y = game_height - y0_trans;
          sprite.setWidth(y1_trans - y0_trans);
          sprite.setTextureRectangle([(1 - u1)*sprite.getTexture().width, 0, (1 - u0)*sprite.getTexture().width, 256]);
          draw2D.drawSprite(sprite);
        }
      }
      function drawTiledSpriteRight(sprite, x, y, u, w) {
        u = u / TILE_DIST;
        var iu = Math.floor(u);
        var du = w / TILE_DIST;
        var u0 = u - iu;
        var u1 = u + du - iu;
        let y0_trans = level_params.transform(y - y0_warp) + y0_warp;
        let y1_trans = level_params.transform((y + w) - y0_warp) + y0_warp;
        if (u1 > 1) {
          var frac0 = (1 - u0) / du;
          let ymid_trans = level_params.transform((y + frac0 * w) - y0_warp) + y0_warp;
          sprite.x = x;
          sprite.y = game_height - y0_trans;
          sprite.setWidth(ymid_trans - y0_trans);
          sprite.setTextureRectangle([u0*sprite.getTexture().width, 0, 256, 256]);
          draw2D.drawSprite(sprite);
          sprite.x = x;
          sprite.y = game_height - ymid_trans;
          sprite.setWidth(y1_trans - ymid_trans);
          sprite.setTextureRectangle([0, 0, (u1 - 1)*sprite.getTexture().width, 256]);
          draw2D.drawSprite(sprite);
        } else {
          sprite.x = x;
          sprite.y = game_height - y0_trans;
          sprite.setWidth(y1_trans - y0_trans);
          sprite.setTextureRectangle([u0*sprite.getTexture().width, 0, u1*sprite.getTexture().width, 256]);
          draw2D.drawSprite(sprite);
        }
      }

      // left
      let side_state = player.level_state[0];
      let orig_state = level_state_orig[(idx % 2) ? 1 : 0];
      let screen_pos0_left = player.pos - game_height/2 - player.pos_offset;
      let screen_pos1_left = screen_pos0_left + game_height - player.pos_offset;
      let max = Math.min(side_state.length, Math.floor(screen_pos1_left + padding));
      let good = 0;
      if (state & 1) {
        // needs tiling to be cool!
        // var rect = player.beam_left.getTextureRectangle();
        // rect[1] += dt/2;
        // rect[3] += dt/2;
        // player.beam_left.setTextureRectangle(rect);
        let y_orig = player.beam_left.y;
        if (orig_state[this_left_pos]) {
          player.beam_left.y += Math.random()*8 - 4;
          player.beam_left.setColor([0.2, 0, 0.5, 1]);
        } else {
          player.beam_left.setColor(color_white);
        }
        draw2D.drawSprite(player.beam_left);
        player.beam_left.y = y_orig;
        // flip bits
        if (speed_scale_left < 0) {
          for (let pos = last_left_pos; pos >= this_left_pos; --pos) {
            if (pos >= 0 && pos < side_state.length) {
              side_state[pos] = !orig_state[pos];
              good += orig_state[pos] ? -1 : 1;
            }
          }
        } else {
          for (let pos = last_left_pos; pos <= this_left_pos; ++pos) {
            if (pos >= 0 && pos < side_state.length) {
              side_state[pos] = !orig_state[pos];
              good += orig_state[pos] ? -1 : 1;
            }
          }
        }
        if (good > 0) {
          if (sounds.good) {
            sound_source_left.play(sounds.good);
          }
        } else if (good < 0) {
          if (sounds.bad) {
            sound_source_left.play(sounds.bad);
          }
        }
      }
      if ((idx % 2) === 0) {
        if (state & 1) {
          if (good > 0) {
            player.bad_hit_streak = 0;
          } else if (good < 0) {
            player.bad_hit_streak += -good;
          }
        } else {
          player.bad_hit_streak = 0;
        }
      }
      for (let ii = Math.max(0, Math.floor(screen_pos0_left - padding)); ii < max; ) {
        let bit = side_state[ii];
        let len = 0;
        let i0 = ii;
        while (ii < max && side_state[ii] === bit && len < max_len) {
          ++ii;
          ++len;
        }
        let y0 = i0 - screen_pos0_left;
        let y1 = i0 + len - screen_pos0_left;
        let sprite = bit ? turf_good_left : turf_bad_left;
        drawTiledSpriteLeft(sprite, x0, y0, i0, y1 - y0);
      }
      for (let pos = last_left_pos; pos <= this_left_pos; ++pos) {
        if (pos >= 0 && pos < side_state.length) {
          if (side_state[pos]) {
            player.good++;
          }
          player.possible++;
          if ((idx % 2) === 0) {
            if (side_state[pos]) {
              player.miss_streak = 0;
            } else {
              if (!(state & 1)) {
                // it's bad, and the player is not hitting it
                player.miss_streak++;
              }
            }
          }
        }
      }
      if (this_left_pos < side_state.length + end_delay_px && speed_scale_left > 0) {
        any_not_done = true;
      }

      // right
      side_state = player.level_state[1];
      orig_state = level_state_orig[(idx % 2) ? 0 : 1];
      let screen_pos0_right = player.pos_right - game_height/2 - player.pos_offset;
      let screen_pos1_right = screen_pos0_right + game_height - player.pos_offset;
      max = Math.min(side_state.length, Math.floor(screen_pos1_right + padding));
      good = 0;
      if (state & 2) {
        let y_orig = player.beam_right.y;
        if (orig_state[this_right_pos]) {
          player.beam_left.y += Math.random()*8 - 4;
          player.beam_right.setColor([0.2, 0, 0.5, 1]);
        } else {
          player.beam_right.setColor(color_white);
        }
        draw2D.drawSprite(player.beam_right);
        player.beam_right.y = y_orig;
        // Flip bits
        if (speed_scale_right < 0) {
          for (let pos = last_right_pos; pos >= this_right_pos; --pos) {
            if (pos >= 0 && pos < side_state.length) {
              side_state[pos] = !orig_state[pos];
              good += orig_state[pos] ? -1 : 1;
            }
          }
        } else {
          for (let pos = last_right_pos; pos <= this_right_pos; ++pos) {
            if (pos >= 0 && pos < side_state.length) {
              side_state[pos] = !orig_state[pos];
              good += orig_state[pos] ? -1 : 1;
            }
          }
        }
        if (good > 0) {
          if (sounds.good) {
            sound_source_right.play(sounds.good);
          }
        } else if (good < 0) {
          if (sounds.bad) {
            sound_source_right.play(sounds.bad);
          }
        }
      }
      if ((idx % 2) === 1) {
        if (state & 2) {
          if (good > 0) {
            player.bad_hit_streak = 0;
          } else if (good < 0) {
            player.bad_hit_streak += -good;
          }
        } else {
          player.bad_hit_streak = 0;
        }
      }
      for (let ii = Math.max(0, Math.floor(screen_pos0_right - padding)); ii < max; ) {
        let bit = side_state[ii];
        let len = 0;
        let i0 = ii;
        while (ii < max && side_state[ii] === bit && len < max_len) {
          ++ii;
          ++len;
        }
        let y0 = i0 - screen_pos0_right;
        let y1 = i0 + len - screen_pos0_right;
        let sprite = bit ? turf_good_right : turf_bad_right;
        drawTiledSpriteRight(sprite, x1, y0, i0, y1 - y0);
      }

      for (let pos = last_right_pos; pos <= this_right_pos; ++pos) {
        if (pos >= 0 && pos < side_state.length) {
          if (side_state[pos]) {
            player.good++;
          }
          player.possible++;
          if ((idx % 2) === 1) {
            if (side_state[pos]) {
              player.miss_streak = 0;
            } else {
              if (!(state & 2)) {
                // it's bad, and the player is not hitting it
                player.miss_streak++;
              }
            }
          }
        }
      }
      if (this_right_pos < side_state.length + end_delay_px && speed_scale_right > 0) {
        any_not_done = true;
      }

      draw2D.drawSprite(player.sprite);

      draw2D.drawSprite(player.bar_bg);
      player.bar_fg.setWidth(Math.max(player.good, 1) / Math.max(player.possible, 1) * (bar_width - bar_pad * 2));
      draw2D.drawSprite(player.bar_fg);

      let hint = '';
      if (level_params.hints) {
        if (player.miss_streak > 80) {
          hint = 'Shoot the unhealthy plants!';
        } else if (player.bad_hit_streak > 40) {
          hint = 'Do not shoot the healthy plants!';
        }
      }
      if (hint !== hint_shown[idx]) {
        $('#hint' + idx).text(hint);
      }
      if (hint) {
        if (!hint_shown[idx]) {
          $('#hint' + idx).addClass('shown');
        }
      } else {
        if (hint_shown[idx]) {
          $('#hint' + idx).removeClass('shown');
        }
      }
      hint_shown[idx] = hint;
    });

    if (!any_not_done) {
      game_state = roundEndInit;
    }
  }

  var round_end_countdown;
  function roundEndInit(dt) {
    $('.screen').hide();
    $('#roundEnd').show();

    var player_ids = Object.keys(players);
    player_ids.sort(function (p0, p1) {
      return players[p1].good - players[p0].good;
    });
    var html = [];
    html.push('<h2>Level ' + (current_level + 1) + '/' + num_levels + '</h2>' +
      ((players.length === 1) ? '<h1>Level complete!</h1>' :
      '<h1>Player ' + (Number(player_ids[0]) + 1) + ' Wins!</h1>') +
      '<br/>');
    var high_score = 0;
    player_ids.forEach(function (pid) {
      var player = players[pid];
      var p = player.good * 100 / player.possible;
      player.cumulative.push(p);
      var sum = 0;
      player.cumulative.forEach(function (v) {
        sum += v;
      });
      var avg = sum / player.cumulative.length;
      high_score = Math.max(high_score, avg);
      html.push('Player ' + (Number(pid) + 1) + ': ' + p.toFixed(1) + '%' +
        (player.cumulative.length > 1 ? ' on this level, ' + avg.toFixed(0) + '% total' : '') +
        '<br/>');
    });
    $('#round_end_results').html(html.join('\n'));
    if (current_level === num_levels - 1) {
      $('#round_end_message').html('<h2>All levels complete!</h2>(Click anywhere to restart)');
      //$('#highscore').show();
      var name = 'Anon' + Math.random().toString().slice(2);
      $.ajax({ url: 'api/scoreset?name=' + name + '&score=' + high_score, success: function (scores) {
        var keys = Object.keys(scores);
        keys.sort(function (k1, k2) {
          return scores[k2] - scores[k1];
        });
        keys = keys.slice(0, 10);
        var html = [];
        var had_b = false;
        keys.forEach(function (name, idx) {
          var b = Math.abs(scores[name] - high_score) < 0.01 && !had_b;
          if (b) {
            had_b = true;
          }
          html.push((b ? '<b>' : '') + '#' + (idx +1) + '. ' + scores[name].toFixed(1) + '%' + (b ? '</b>' : ''));
        });
        $('#scores').html('<h3>High Scores</h3>' + html.join('<br/>'));
      }});
    }

    round_end_countdown = 10000;
    game_state = roundEnd;
    roundEnd(dt);
  }

  function roundEnd(dt) {
    // dec, maybe finish
    round_end_countdown -= dt;
    players.forEach(function (player) {
      if (input_devices[player.input_idx]()) {
        round_end_countdown -= dt * 5;
      }
    });
    if (current_level === num_levels - 1) {
      // Message/form set above
      if (input.clickHit(0, 0, game_width, game_height)) {
        game_state = choosePlayerInit;
      }
    } else {
      if (round_end_countdown < 0) {
        round_end_countdown = 0;
        ++current_level;
        game_state = newLevelInit;
      }
      $('#round_end_message').html('Level complete<br/><br/>Next level starting in ' + (round_end_countdown / 1000).toFixed(1) + 's...' +
        '<br/>(Hold buttons to advance)');
    }
  }

  function test() {
    if (!test.color_sprite) {
      test.color_sprite = color_white;
      var spriteSize = 64;
      test.sprite = createSprite('cloud.png', {
        width : spriteSize,
        height : spriteSize,
        x : (Math.random() * (game_width - spriteSize) + (spriteSize * 0.5)),
        y : (Math.random() * (game_height - spriteSize) + (spriteSize * 0.5)),
        rotation : 0,
        color : test.color_sprite,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
    }

    // test.sprite.x = (Math.random() * (game_width - spriteSize) + (spriteSize * 0.5));
    // test.sprite.y = (Math.random() * (game_height - spriteSize) + (spriteSize * 0.5));

    var character = {
      dx: 0,
      dy: 0,
    };
    if (input.isKeyDown(keyCodes.LEFT) || input.isKeyDown(keyCodes.A) || input.isPadButtonDown(0, padCodes.LEFT)) {
      character.dx = -1;
    } else if (input.isKeyDown(keyCodes.RIGHT) || input.isKeyDown(keyCodes.D) || input.isPadButtonDown(0, padCodes.RIGHT)) {
      character.dx = 1;
    }
    if (input.isKeyDown(keyCodes.UP) || input.isKeyDown(keyCodes.W) || input.isPadButtonDown(0, padCodes.UP)) {
      character.dy = -1;
    } else if (input.isKeyDown(keyCodes.DOWN) || input.isKeyDown(keyCodes.S) || input.isPadButtonDown(0, padCodes.DOWN)) {
      character.dy = 1;
    }

    test.sprite.x += character.dx;
    test.sprite.y += character.dy;
    if (input.isMouseDown() && input.isMouseOverSprite(test.sprite)) {
      test.sprite.setColor(color_yellow);
    } else if (input.clickHitSprite(test.sprite)) {
      test.color_sprite = (test.color_sprite === color_red) ? color_white : color_red;
      test.sprite.setColor(test.color_sprite);
    } else if (input.isMouseOverSprite(test.sprite)) {
      test.color_sprite[3] = 0.5;
      test.sprite.setColor(test.color_sprite);
    } else {
      test.color_sprite[3] = 1;
      test.sprite.setColor(test.color_sprite);
    }

    draw2D.drawSprite(test.sprite);
  }

  game_state = choosePlayerInit;

  var last_tick = Date.now();
  function tick() {
    if (!graphicsDevice.beginFrame()) {
      return;
    }
    var now = Date.now();
    var dt = Math.min(Math.max(now - last_tick, 1), 250);
    last_tick = now;
    input.tick();
    draw2D.configure(configureParams);

    if (window.need_repos) {
      --window.need_repos;
      var viewport = draw2D.getScreenSpaceViewport();
      $('#screen').css({
        left: viewport[0],
        top: viewport[1],
        width: viewport[2] - viewport[0],
        height: viewport[3] - viewport[1],
      });
    }

    draw2D.setBackBuffer();
    draw2D.clear([0, 0.72, 1, 1]);

    draw2D.begin('alpha', 'deferred');

    game_state(dt);

    draw2D.end();
    graphicsDevice.endFrame();
  }

  intervalID = TurbulenzEngine.setInterval(tick, 1000/60);
};
