/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class miasmaAndMonstersMonsterSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        let w = 340
        let h = 465


        return mergeObject(super.defaultOptions, {
            classes: ["miasmaAndMonsters", "sheet", "actor"],
            template: "systems/miasmaAndMonsters/templates/actor/actor-sheet.html",
            width: w,
            height: h,
            tabs: [{
                navSelector: ".sheet-tabs",
                contentSelector: ".sheet-body",
                initial: "description"
            }]
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

        return data;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareMonsterItems(sheetData) {
        const actorData = sheetData.actor;

        // Initialize containers.

        // Iterate through items, allocating to containers
        // let totalWeight = 0;
        for (let i of sheetData.items) {
            let item = i.data;
            console.log(i.data.bonus);    
        }

    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
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


        // Make a chat message appear when clicking on a monsters attack
        html.find(".monster-attack-button").click(ev => {
            let attackKey = $(ev.currentTarget).parents(".attack-row").data("label");

            let attackData = this.actor.data.data.attacks[attackKey];
            //attackData.bonus, attackData.name, attackData.damageformula

            
            // Generate the random attack flavour
            let randomAttackMessage = "";
            const randomAttacks = ["Attacks", "Strikes", "Swings", "Thrusts", "Pummels", "Takes aim", "Lunges"]
            
            let numGen = new MersenneTwister;
            if (numGen.int()%3 < 2) {
                // 2/3 chance to just say "Attacks!"
                randomAttackMessage = "Attacks"
            } else {
                randomAttackMessage = randomAttacks[numGen.int() % randomAttacks.length];
            }
            
            randomAttackMessage += " with its "
            randomAttackMessage += attackData.name + "!"

            // Make the rolls
            let attackRoll = new Roll("1d20 + @bonus", attackData);
            let atkRoll = attackRoll.roll().total;
            console.log(atkRoll);

            let damageRoll = new Roll(attackData.damageformula, attackData); 
            console.log(damageRoll);
            let dmg = Number(damageRoll.roll().total);
            console.log(dmg);
            
            // Check for critical hit
            if (Number(atkRoll) - Number(attackData.bonus) == 20) {
                randomAttackMessage = "CRITICALLY " + randomAttackMessage;

                // Roll another damage for the crit
                let critRoll = new Roll(attackData.damageformula, attackData); 
                dmg += Number(critRoll.roll().total);
            }
            
            damageRoll.toMessage({
                speaker: ChatMessage.getSpeaker({
                    actor: this.actor
                }),
                content: `<div class="dice-roll monster-attack">
                <span class="flavor-text">` + randomAttackMessage + `</span>
                <h4>
                <div class="dice-total">` + Number(atkRoll) + `</div>
                </h4>
                <span class="flavor-text"> The attack deals... </span>
                <h4 class="monster-damage-roll">
                <div class="dice-total">` + dmg + ` damage
                </div>
                </h4>
                </div>`
            });
            

        });

        //remember random ID for generating new attacks
        html.find(".monster-new-attack").click(ev => {

            // Copy Pasted from nokilaj-a on the foundry discord, give some credit to him somewhere
            const attacks = duplicate(this.actor.data.data.attacks ?? []);
            attacks[randomID()] = {
                name: "New Attack",
                bonus: 0,
                damageformula: "1d6"
            };
            this.actor.update({
                'data.attacks': attacks
            });
            //this.actor.render(); // if you want to also update the  UI


        });
        
        // Delete a monsters attack
        html.find(".delete-monster-attack").click(ev => {

            let attackKey = $(ev.currentTarget).parents(".attack-row").data("label");

            console.log(attackKey);
            
            const attacks = duplicate(this.actor.data.data.attacks ?? []);

            delete attacks[attackKey]
            
            let key = "-=" + attackKey

            attacks[key] = null;
            this.actor.update({'data.attacks': attacks});
            //this.actor.render(); // if you want to also update the  UI
        });
    }

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        // Make no items MWAHAHA!
        return false;
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
                speaker: ChatMessage.getSpeaker({
                    actor: this.actor
                }),
                flavor: label
            });
        }
    }

    

}
