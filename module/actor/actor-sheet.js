/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class miasmaAndMonstersActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    let w = 800
    let h = 550

    return mergeObject(super.defaultOptions, {
      classes: ["miasmaAndMonsters", "sheet", "actor"],
      template: "systems/miasmaAndMonsters/templates/actor/actor-sheet.html",
      width: w,
      height: h,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /* -------------------------------------------- */

  /** 

  /**
   * Change the actor sheet finding system to support multiple types
   * 
   * @override
   */
  get template() {
    const path = "systems/miasmaAndMonsters/templates/actor";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.html`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.html`.

    return `${path}/${this.actor.data.type}-sheet.html`;
  }

  /** @override */
  getData() {
    const data = super.getData();
    /* data.dtypes = ["String", "Number", "Boolean"];
    for (let attr of Object.values(data.data.attributes)) {
      attr.isCheckbox = attr.dtype === "Boolean";
    } */

    // Prepare items.
    if (this.actor.data.type == 'character') {
      this._prepareCharacterItems(data);
    }

    return data;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.actor;

    // Initialize containers.

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    let totalSlots = 0;
    for (let i of sheetData.items) {
      let item = i.data;
      totalSlots += Number(item.slotstaken);
    }

    // Add weight from coins
    let totalCoins = actorData.data.coins.copper + actorData.data.coins.silver + actorData.data.coins.gold + actorData.data.coins.platinum
    let coinSlots = (totalCoins - (totalCoins % 100)) / 100

    totalSlots += coinSlots
    
    //console.log(totalSlots);

    actorData.data.attributes.slotsremaining = actorData.data.abilities.con.defense - totalSlots;
  
  }

  /* -------------------------------------------- */

  /** @override */
  async activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      // const li = $(ev.currentTarget).parents(".item"); // This line is default
      const li = $(ev.currentTarget); // This makes it so we can edit an item by clicking onit.
      const item = this.actor.getOwnedItem(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      ev.stopPropagation(); // This makes it so we can delete and item without it popping up

      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(li.data("itemId"));
      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));


    // Steal Item Dragging Code
    let handler = ev => this._onDragItemStart(ev);
    html.find('.item-row').each((index, itemRow) => {
      if (itemRow.classList.contains("item-head-row")) return;
      itemRow.setAttribute("draggable", true);
      itemRow.addEventListener("dragstart", handler, false);
    });


    html.find('.generate-character').click( async (ev) => {
      //console.log(ev);
      console.log("Let's generate this baby!!");
    
      let act = this.actor;

      // Generate Ability Scores
      console.log("Character Generating: Ability Scores")
      
      let abilis = duplicate(act.data.data.abilities);
      
      for (let [key, ability] of Object.entries(abilis)) {
        let abilityRoll = new Roll("3d6dh2")
        abilityRoll.roll()
        
        //console.log(abilityRoll.result);
        
        // Calculate the modifier using d20 rules.
        //ability.mod = Math.floor((ability.value - 10) / 2);
        ability.defense = 10 + Number(abilityRoll.result);
      }
      
      act.update({'data.abilities': abilis});
      
      // Hit Points
      console.log("Character Generating: Rolling Hit Points")
      let HPRoll = new Roll("1d8");
      HPRoll.roll();
      
      
      let newHealth = {
        value: HPRoll.result,
        min: 0,
        max: HPRoll.result
      }
      
      act.update({'data.health': newHealth});
      

      // If the corresponding game setting is on, clear the inventory
      if (game.settings.get("miasmaAndMonsters", "clearInvOnGen")) {

        console.log("Character Generating: Clearing Inventory");

        let ids = [];

        html.find('.item-delete').each((index, btn) => {
          let par = $(btn).parents(".item");
          let id = par.data("itemId");
          ids.push(id);
        });

        act.deleteOwnedItem(ids);

        // Set all coins to 0 too.
        act.update({
          'data.coins.copper': 0,
          'data.coins.silver': 0,
          'data.coins.gold': 0,
          'data.coins.platinum': 0,
        })

      }
      
      // All characters start with 2 days of travel rations
      const toolGearPack = game.packs.get("miasmaAndMonsters.tools-and-gear");
      const toolGearIndex = await toolGearPack.getIndex();
      
      const rationId = toolGearIndex.find(e => e.name == "Travel Rations (1 day)")._id;
      
      act.importItemFromCollection("miasmaAndMonsters.tools-and-gear", rationId);
      
      
      // Find the pack with all the rollable tables in it
      const tablePack = game.packs.get("miasmaAndMonsters.character-generation-tables");
      const packIndex = await tablePack.getIndex();
      
      // Starting Armor
      console.log("Character Generating: Generating Armor");
      
      // Reset Armor
      await act.update({
        'data.attributes.armor.defense': 10
      });

      // Find the armor table
      const armorTableId = packIndex.find(e => e.name == "Armor")._id;
      const armorTable = await tablePack.getEntity(armorTableId);

      // Roll for a random armor!
      const armorDraw = await armorTable.roll().results[0];
      
      // If the result is armor, put it in the actors inventory and change their defense!
      if (armorDraw.collection) {
        act.importItemFromCollection(armorDraw.collection, armorDraw.resultId);

        let newArmorDefense;
        switch (armorDraw.text) {
          case "Gambeson":
            newArmorDefense = 10 + 2;
            break;
          case "Brigandine":
            newArmorDefense = 10 + 3;
            break;
          case "Chain":
            newArmorDefense = 10 + 4;
        }

        await act.update({
          'data.attributes.armor.defense': newArmorDefense
        });
      }

      // Starting Helmet / Shield
      console.log("Character Generating: Generating Helmet / Shield");
      
      const hsTableId = await packIndex.find(e => e.name == "Helmets and Shields")._id;
      const hsTable = await tablePack.getEntity(hsTableId);
      
      const hsDraw = await hsTable.roll().results[0];

      if (hsDraw.collection) {
        await act.importItemFromCollection(hsDraw.collection, hsDraw.resultId);
        

        let newArmor = act.data.data.attributes.armor.defense + 1

        // Increment Defense By Two
        act.update({
          'data.attributes.armor.defense':  newArmor})
          
      } else if (hsDraw.text == "Helmet and Shield") {
          // Find the helmet and shield's id
          
          const hsPack = await game.packs.get("miasmaAndMonsters.armor");
          const hsPackIndex = await hsPack.getIndex();
          
          const helmId = hsPackIndex.find(e => e.name == "Helmet")._id;
          const shieldId = hsPackIndex.find(e => e.name == "Shield")._id;
    
          await act.importItemFromCollection("miasmaAndMonsters.armor", helmId);
          await act.importItemFromCollection("miasmaAndMonsters.armor", shieldId);
          
          // Increment Defense By Two
          let newArmor = act.data.data.attributes.armor.defense + 2
          
          await act.update({
            'data.attributes.armor.defense':  newArmor})
        
      }
       
      // Starting Gear
      console.log("Character Generating: Dungeoneering Gear");
      
      const dunGearId = packIndex.find(e => e.name == "Dungeoneering Gear")._id;
      const dunGearTable = await tablePack.getEntity(dunGearId);
      
      
      const dunGearDraw = await dunGearTable.roll().results[0];
      await act.importItemFromCollection(dunGearDraw.collection, dunGearDraw.resultId);
      
      const dunGearDraw2 = await dunGearTable.roll().results[0];
      await act.importItemFromCollection(dunGearDraw2.collection, dunGearDraw2.resultId);
      
      
      console.log("Character Generating: General Gear 1");
      
      const gg1Id = packIndex.find(e => e.name == "General Gear 1")._id;
      const gg1Table = await tablePack.getEntity(gg1Id);
      console.log(gg1Id, gg1Table);
      
      const gg1Draw = await gg1Table.roll().results[0];
      act.importItemFromCollection(gg1Draw.collection, gg1Draw.resultId);

      console.log("Character Generating: General Gear 2");
      
      const gg2Id = packIndex.find(e => e.name == "General Gear 2")._id;
      const gg2Table = await tablePack.getEntity(gg2Id);

      const gg2Draw = await gg2Table.roll().results[0];
      act.importItemFromCollection(gg2Draw.collection, gg2Draw.resultId);
      
      
    });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    const actor = this.getData();

    // Check for encumberance!!
    let makeItemSmall = false;
    if (actor.data.attributes.slotsremaining <= 0) {
      ui.notifications.warn("Not enough item slots!");
      return false;
    } else if (actor.data.attributes.slotsremaining < 1) {
      makeItemSmall = true;
    }

    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // If the inventory has less than one but greater than 0 slots left, make the item a quarter size
    if (makeItemSmall) itemData.data.slotstaken = 0.25;

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.roll) {
      let roll = new Roll(dataset.roll, this.actor.data.data);
      let label = dataset.label ? `Rolling ${dataset.label}` : '';
      roll.roll().toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label
      });
    }
  }

  async _onDrop(event) {
    
    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }
    
    // Test the item's encumberance against the current amount of slots left open
    let itemSlotsTaken;

    // We have to do things a bit different if the item is from a compendium.
    if (data.pack) {
      
      let itemFromCompendium = await game.packs.get(data.pack).getEntry(data.id);
      itemSlotsTaken = itemFromCompendium.data.slotstaken;
      
    
    // Things also change if we provide data explicitly, such as dragging from another player.
    } else if (data.data) {
      itemSlotsTaken = Number(data.data.data.slotstaken);

    } else {
      itemSlotsTaken = game.items.get(data.id).data.data.slotstaken
    }

    let pactor = this.getData();
    if (pactor.data.attributes.slotsremaining < itemSlotsTaken) {
      ui.notifications.warn("Not enough item slots!");
      return false;
    }

    // Case 1 - Import from a Compendium pack
    const actor = this.actor;
    if (data.pack) {
      return actor.importItemFromCollection(data.pack, data.id);
    }
    // Case 2 - Data explicitly provided
    else if (data.data) {
      let sameActor = data.actorId === actor._id;
      if (sameActor && actor.isToken) sameActor = data.tokenId === actor.token.id;
      if (sameActor) return this._onSortItem(event, data.data); // Sort existing items
      else return actor.createEmbeddedEntity("OwnedItem", duplicate(data.data)); // Create a new Item
    }
    // Case 3 - Import from World entity
    else {
      let item = game.items.get(data.id);
      if (!item) return;
      return actor.createEmbeddedEntity("OwnedItem", duplicate(item.data));
    }
  }

}
