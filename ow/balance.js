function Player(info) {
    this.id = info.id;
    this.tank = info.sr_by_class.tank;
    this.dps = parseInt(info.sr_by_class.dps);
    this.support = parseInt(info.sr_by_class.support);
    this.main = info.classes[0]
    this.roles_allowed = info.classes

    // this.main = this.tank > this.dps ? 'tank' : (this.dps > this.support ? 'dps' : 'support');
    // this.roles_allowed = Object.keys(info.sr_by_class)
    //     .filter(key => info.sr_by_class[key] > 0)
    //     .map(key => [key, info.sr_by_class[key]])
    //     .sort((a, b) => b[1] - a[1])
    //     .map(x => x[0])

    this.current = null;
    this.team = null;
    this.movable = true
}

function Team() {
    this.tank = [];
    this.dps = [];
    this.support = [];

    this.id = "";
    this.captain = null;
    this.mate = null;
    this.henchman = null;
    this.sr = null;
    this.players = {};
    this.recalc = function () {
        this.tank.forEach(player => player.current = 'tank');
        this.dps.forEach(player => player.current = 'dps');
        this.support.forEach(player => player.current = 'support');
        let players = [].concat(this.tank, this.dps, this.support).sort((a, b) => b[b.main] - a[a.main]);
        this.players = players.reduce((obj, player) => (obj[player.id] = player, obj), {});
        if (Object.keys(this.players).length < players.length) {
            alert('oops');
            debugger;
        }
        this.id = players[0].id;
        this.sr = players.reduce((sum, player) => sum + player[player.current], 0) / players.length;
        players.forEach(player => player.team = this.id)
    }

    this.replace = function (replace) {
        //replace = {id_replaced: new_player}
        let for_replace = []
        for (let id in replace) {
            if (!replace.hasOwnProperty(id)) continue;
            if (!this.players.hasOwnProperty(id)) continue;
            for (let role of ['tank', 'dps', 'support']) {
                for (let j = 0; j < this[role].length; j++) {
                    if (this[role][j].id == id) {
                        for_replace.push([role, j, replace[id]])
                    }
                }
            }
        }
        for (let ready of for_replace) {
            this[ready[0]][ready[1]] = ready[2]
        }
    }

    this.sr_with_replace = function (replace) {
        //replace = {id_replaced: new_player}
        return Object.keys(this.players)
            .reduce(
                (sum, id) => sum + (
                    id in replace ?
                        replace[id][this.players[id].current] :
                        this.players[id][this.players[id].current]
                ), 0
            ) / Object.keys(this.players).length;
    }
}

function balance(input) {
    let players = JSON.parse(input).players.map(info => new Player(info));
    players.sort((a, b) => b[b.main] - a[a.main]);
    let n = players.length / 6;
    let n_henchmans = n; // could be less
    let teams = Array(n).fill(null).map(() => new Team());

    // put captains on their main roles
    let captains = players.slice(0, n);
    for (let i = 0; i < n; i++) {
        teams[i][captains[i].main].push(captains[i]);
        teams[i].captain = captains[i];
        teams[i].recalc();
    }
    // add henchmans
    let henchmans = players.slice(-n_henchmans).reverse();
    let enough_henchmans_for_dd = captains.filter(p => p.current == 'dps').length <= henchmans.filter(p => p.main != 'support').length
    let henchman_for_dd = (team, player) => {
        if (team.captain.current == 'dps' && player.main != 'support') {
            return player.main;
        } else if (!enough_henchmans_for_dd && player.roles_allowed.length > 1) {
            return player.roles_allowed[1];
        } else if (team.captain.current == 'dps') {
            return [0, 1];
        } else {
            return [1, 0];
        }
    }
    let henchman_any = (team, player) => {
        return Object.keys(team.players).length > 1 ? [1, 0] : player.main;
    }
    fill_by_cond(teams, henchmans, henchman_for_dd);
    fill_by_cond(teams, henchmans, henchman_any);
    for (let team of teams) {
        team.henchman = Object.values(team.players).sort((a, b) => b[b.current] - a[a.current])[1]
    }

    // Add mates
    let mates = players.slice(n, 2 * n);
    teams.reverse();

    let mate_for_capitan = (team, player) => {
        if (Object.keys(team.players).length > 2 || team.captain.current == player.main) {
            return [1, 0];
        } else {
            return player.main;
        }
    }
    let mate_any = condition_any(3)
    for (let mate of mates) {
        let filled =
            fill_by_cond(teams, [mate], mate_for_capitan) ||
            fill_by_cond(teams, [mate], mate_any);
        if (!filled) {
            fix_not_filled(teams, players, players.indexOf(mate), 2 * n, mate_any)
        }
    }
    for (let team of teams) {
        if (Object.keys(team.players).length < 3) {
            //TODO add mates if not found
            alert("Balancer bugged: cannot add mates")
        }
        team.mate = Object.values(team.players).sort((a, b) => b[b.current] - a[a.current])[1]
    }

    // Add third top players
    teams.sort((a, b) => a.sr - b.sr);
    let thirds = players.slice(2 * n, 3 * n);
    let third_best = (team, player) => {
        if (Object.keys(team.players).length > 3) {
            return [1, 0];
        }
        for (let role of player.roles_allowed) {
            if (player[role] != team.captain.current && player[role] != team.mate.current && team[role].length < 2) {
                return role;
            }
        }
        return [1, 0];
    }
    let third_not_cap = (team, player) => {
        if (Object.keys(team.players).length > 3) {
            return [1, 0];
        }
        for (let role of player.roles_allowed) {
            if (player[role] != team.captain.current && team[role].length < 2) {
                return role;
            }
        }
        return [1, 0];
    }
    let third_any = condition_any(4)
    for (let third of thirds) {
        let filled =
            fill_by_cond(teams, [third], third_best) ||
            fill_by_cond(teams, [third], third_not_cap) ||
            fill_by_cond(teams, [third], third_any);
        if (!filled) {
            fix_not_filled(teams, players, players.indexOf(third), 3 * n, third_any)
        }
    }

    players.forEach(player => player.team && (player.movable = false));

    // Fill teams with remaining players
    fill_by_roles(teams, players.slice(3 * n, 5 * n))

    shuffle_random(teams)
    teams.forEach(team => team.recalc()) // Just to be sure
    console.log(teams);
    verify_teams(teams, input);
    return teams
}

/**
 * @callback TeamPlayer
 * @param {Team} team
 * @param {Player} player
 * @return {[int, int] | string}
 */

/**
 *
 * @param {Team[]} teams
 * @param {Player[]} players
 * @param {TeamPlayer} condition
 * @returns {number}
 */
function fill_by_cond(teams, players, condition) {
    let n_teams = teams.length;
    let i_team = 0;
    let i_player = 0;
    let n_filled = 0
    while (i_team < n_teams && i_player < players.length) {
        let role = condition(teams[i_team], players[i_player]);
        if (Array.isArray(role)) {
            i_team += role[0];
            i_player += role[1];
        } else {
            let player = players.splice(i_player, 1)[0]; // remove from players
            teams[i_team][role].push(player);
            teams[i_team].recalc();
            if (teams[i_team][role].length > 2) {
                debugger;
            }
            i_team++;
            n_filled++;
        }
        if (i_player >= players.length) {
            break;
        }
    }
    return n_filled
}

/**
 *
 * @param {Team[]} teams
 * @param {Player[]} players
 */
function fill_by_roles(teams, players) {
    //Just for logging
    let unfilled_roles = teams.reduce((roles, team) => {
        roles['tank'] += 2 - team.tank.length
        roles['dps'] += 2 - team.dps.length
        roles['support'] += 2 - team.support.length
        return roles
    }, {'tank': 0, 'dps': 0, 'support': 0});
    console.log(unfilled_roles);

    let remain_roles = players.reduce((roles, player) => {
        roles[player.main]++;
        return roles;
    }, {'tank': 0, 'dps': 0, 'support': 0})
    console.log(remain_roles);

    let splitted = players.reduce((arr, player) => {
        arr[player.roles_allowed.length - 1].push(player);
        return arr;
    }, [[], [], []])

    // Add single-role, then double-role, then tripple-role players. Not optimized, could fail.
    for (let chunk of splitted) {
        for (let player of chunk) {
            if (!fill_by_cond(teams, [player], condition_any(6))) {
                alert('oops')
                return
            }
        }
    }
}

function fix_not_filled(teams, players, idx, start, condition) {
    for (let j = start; j < players.length; j++) {
        if (fill_by_cond(teams, [players[j]], condition)) {
            [players[idx], players[j]] = [players[j], players[idx]]
            break
        }
    }
}

/**
 *
 * @param {Team[]} teams
 */
function shuffle_random(teams) {
    let n = teams.length;
    const TIMEOUT = 1000;
    const PICK_TEAM = 4;
    const PICK_PLAYERS = 3;
    let target = target_function(teams.map(team => team.sr));
    console.log({target});

    let time = new Date().getTime();
    let team_rolls = 0
    let team_shuffles = 0
    while (true) {
        team_rolls++;
        let random_teams = n_random(teams, PICK_TEAM);
        let movable_players = [].concat(...random_teams.map(
            team => Object.values(team.players).filter(player => player.movable)
        ));
        let prev = random_teams.map(team => team.sr);
        let can_play = (roles) => (position, player) => player[roles[position]] > 0;
        for (let randoms of combinator(movable_players, PICK_PLAYERS)) {
            let roles = randoms.map(player => player.current);
            let selected = {target: target, players: randoms};
            for (let mix of permutator(randoms.slice(), PICK_PLAYERS, can_play(roles))) {
                team_shuffles++;
                let replace = randoms.reduce((obj, player, idx) => (obj[player.id] = mix[idx], obj), {});
                // let next = random_teams.map(team => team.sr_with_replace(replace))
                // let new_target = adjust_target_func(target, n, prev, next)
                let new_target = target_function(teams.map(team => team.sr_with_replace(replace)));
                if (new_target < selected.target) {
                    selected = {target: new_target, players: replace};
                }
            }
            if (selected.target < target) {
                random_teams.forEach(team => team.replace(selected.players));
                random_teams.forEach(team => team.recalc());
                prev = random_teams.map(team => team.sr);
                target = selected.target;
            }
        }

        if (new Date().getTime() - time > TIMEOUT) {
            break;
        }
    }
    console.log({target: target});
    console.log({team_rolls});
    console.log({team_shuffles});
}

function target_function(teams) {
    //Just a usual dispersion for now
    let n = teams.length;
    let S = 0;
    let S2 = 0;
    for (let team of teams) {
        S2 += team * team;
        S += team;
    }
    return S2 / n - S / n * S / n
}

function adjust_target_func(value, n, prev, next) {
    let len = Math.min(prev.length, next.length);
    for (let i = 0; i < len; i++) {
        // Difference between two dispersions if only one value was changed.
        value = value +
            (next[i] * next[i] - prev[i] * prev[i]) / n -
            (next[i] - prev[i]) * (next[i] - prev[i] + 2 * value) / (n * n)
    }
    return value
}

function condition_any(count) {
    return (team, player) => {
        if (Object.keys(team.players).length >= count) {
            return [1, 0]
        }
        for (let role of player.roles_allowed) {
            if (team[role].length < 2) {
                return role;
            }
        }
        return [1, 0];
    }
}

function n_random(source, n) {
    let arr = [];
    while (arr.length < n) {
        let random = Math.floor(Math.random() * source.length);
        if (arr.indexOf(random) === -1) arr.push(random);
    }
    return arr.map(idx => source[idx])
}

function verify_teams(teams, source) {
    if (!teams.every(team => Object.keys(team.players).length == 6)) {
        alert("Verification failed. Team size!=6")
    }
    if (!teams.every(team => team.dps.length == 2 && team.tank.length == 2 && team.support.length == 2)) {
        alert("Verification failed. Role size!=2")
    }
    let players = JSON.parse(source).players.map(info => new Player(info));
    let team_players = [].concat(...teams.map(team => [].concat(team.tank, team.dps, team.support))).map(player => player.id);
    if (players.length != team_players.length || !players.every(player => team_players.indexOf(player.id) > -1)) {
        alert("Verification failed. Players are not equal")
    }

    let by_id = players.reduce((obj, player) => (obj[player.id] = player, obj), {});

    for (let team of teams) {
        for (let role of ['tank', 'dps', 'support']) {
            if (!team[role].every(player => player[role] > 0 && player[role] == by_id[player.id][role])) {
                alert("Verification failed. Bad role or sr assigned")
            }
        }
    }
}

function player_prof(team, player) {
    if (team.captain.id == player.id) {
        return 'captain'
    } else if (team.henchman.id == player.id) {
        return 'henchman'
    } else if (team.mate.id == player.id) {
        return 'mate'
    } else {
        return ''
    }
}
function export_teams(teams) {
    teams.sort((a, b) => a.sr - b.sr);

    function player_str(player, prof) {
        return [
            player[player.current],
            player.current,
            player.id,
            ...prof ? [`(${prof})`] : []
        ].join("\t")
    }

    function team_str(team) {
        return [
            `Team ${team.id} (SR ${team.sr.toFixed(0)})`,
            ...(Object.values(team.players).map(player => player_str(player, player_prof(team, player)))),
            ""
        ].join("\n")
    }

    return teams.map(team_str).join("\n")
}

/**
 * @callback PermuteCondition
 * @param {int} position
 * @param {any} value
 * @return {boolean}
 */

/**
 *
 * @param {any[]} array
 * @param {int} length
 * @param {PermuteCondition} condition
 * @return {Generator<*, void, any>}
 */
function* permutator(array, length, condition) {
    length = Math.min(array.length, length)

    function* permute(array, index) {
        if (index == length - 1) {
            for (let i = index; i < array.length; i++) {
                if (!condition(index, array[i])) continue;
                yield [].concat(array.slice(0, index), array[i]);
            }
        } else {
            for (let i = index; i < array.length; i++) {
                if (!condition(index, array[i])) continue;
                [array[i], array[index]] = [array[index], array[i]];
                yield* permute(array, index + 1);
                [array[i], array[index]] = [array[index], array[i]];
            }
        }
    }

    yield* permute(array, 0);
}


function* combinator(elements, length) {
    function* combine(elements, index) {
        for (let i = 0; i < elements.length; i++) {
            if (index == 1) {
                yield [elements[i]]
            } else {
                for (let next of combine(elements.slice(i + 1, elements.len), index - 1)) {
                    yield [].concat(elements[i], next)
                }
            }
        }
    }

    yield* combine(elements, length);
}


function display_output(teams, output, team_tpl, player_tpl) {
    teams.sort((a, b) => a.sr - b.sr);

    function rank(sr) {
        switch (true) {
            case sr < 1500:
                return 'bronze';
            case sr < 2000:
                return 'silver';
            case sr < 2500:
                return 'gold';
            case sr < 3000:
                return 'platinum';
            case sr < 3500:
                return 'diamond';
            case sr < 4000:
                return 'master';
            default:
                return 'grandmaster'
        }
    }

    function symprof(prof) {
        switch (prof) {
            case 'captain':
                return '♛'
            case 'henchman':
                return '♞'
            case 'mate':
                return '♝'
            default:
                return ''
        }
    }

    function player_str(player, prof) {
        return player_tpl
            .replace(/\{role\}/g, player.current)
            .replace(/\{sr\}/g, player[player.current])
            .replace(/\{rank\}/g, rank(player[player.current]))
            .replace(/\{name\}/g, player.id)
            .replace(/\{prof\}/g, prof)
            .replace(/\{symprof\}/g, symprof(prof))
    }

    function team_str(team) {
        let players = [].concat(team.tank, team.dps, team.support).map(player => player_str(player, player_prof(team, player)))
        return team_tpl
            .replace('{teamid}', team.id)
            .replace('{teamsr}', team.sr.toFixed(0))
            .replace('{players}', players.join("\n"))
    }

    output.innerHTML = teams.map(team_str).join("\n")
}