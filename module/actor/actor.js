/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class miasmaAndMonstersActor extends Actor {

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this.data;
    const data = actorData.data;
    const flags = actorData.flags;

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    if (actorData.type === 'character') this._prepareCharacterData(actorData);
    if (actorData.type === 'monster') this._prepareMonsterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.data;
    // Make modifications to data here. For example:
    
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (let [key, ability] of Object.entries(data.abilities)) {
      // Calculate the modifier using d20 rules.
      //ability.mod = Math.floor((ability.value - 10) / 2);
      ability.bonus = ability.defense - 10;
    }
    
    data.attributes.armor.bonus = data.attributes.armor.defense - 10;
  }
  
  _prepareMonsterData(actorData) {
    const data = actorData.data;

    // 
    if (game.settings.get("miasmaAndMonsters", "autoMonsterHP") ) {
      data.health.max = data.attributes.hitdice.amount * data.attributes.hitdice.multiplier;
    }



    for (let [key, ability] of Object.entries(data.abilities)) {
      // Calculate the modifier using d20 rules.
      if (data.options.hitdiceabilities) ability.defense = Number(data.attributes.hitdice.amount) + 10;
      //ability.mod = Math.floor((ability.value - 10) / 2);
      ability.bonus = ability.defense - 10;
    }
  }

}