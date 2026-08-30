// Wiki file titles resolve through redirects, so the plain name is usually enough.
// Items/blocks use the "Invicon " inventory-sprite prefix; mobs use the render name.

export const MC_ITEMS = [
  'Diamond Sword','Netherite Ingot','Netherite Scrap','Ancient Debris','Elytra','Ender Pearl','Eye of Ender',
  'Blaze Rod','Blaze Powder','Totem of Undying','Trident','Enchanted Golden Apple','Golden Apple','Nether Star',
  'Beacon','Conduit','Heart of the Sea','Nautilus Shell','Prismarine Shard','Prismarine Crystals','Ghast Tear',
  'Dragon Egg','Dragon Breath','End Crystal','Firework Rocket','Spyglass','Lodestone','Recovery Compass',
  'Echo Shard','Sculk Sensor','Sculk Catalyst','Sculk Shrieker','Amethyst Shard','Spore Blossom','Glow Berries',
  'Copper Ingot','Lightning Rod','Pointed Dripstone','Goat Horn','Brush','Trial Key','Ominous Bottle','Mace',
  'Wind Charge','Breeze Rod','Crafter','Heavy Core','Bundle','Netherite Pickaxe','Diamond Pickaxe','Golden Carrot',
  "Rabbit's Foot",'Phantom Membrane','Turtle Helmet','Redstone Dust','Redstone Repeater','Redstone Comparator',
  'Observer','Piston','Sticky Piston','Hopper','Dropper','Dispenser','Anvil','Grindstone','Smithing Table','Loom',
  'Cartography Table','Fletching Table','Composter','Barrel','Blast Furnace','Smoker','Campfire','Lantern',
  'Soul Lantern','Chain','Bell','Scaffolding','Honeycomb','Honey Bottle','Sweet Berries','Cocoa Beans','Nether Wart',
  'Chorus Fruit','Shulker Shell','End Rod','Obsidian','Crying Obsidian','Respawn Anchor','Gilded Blackstone',
  'Soul Soil','Warped Fungus','Crimson Fungus','Shroomlight','Glowstone','Sea Lantern','Slime Ball','Magma Cream',
  'Fermented Spider Eye','Gunpowder','Flint and Steel','Shears','Fishing Rod','Bow','Crossbow','Shield','Saddle',
  'Name Tag','Lead','Book and Quill','Enchanted Book','Bookshelf','Cauldron','Brewing Stand','Ender Chest',
  'Crafting Table','Furnace','Jukebox','Note Block','Target','Daylight Detector','TNT','Bucket','Milk Bucket',
  'Powder Snow Bucket','Armor Stand','Item Frame','Flower Pot','Torch','Soul Torch','Redstone Torch','Lever',
  'Tripwire Hook','Rail','Powered Rail','Detector Rail','Activator Rail','Minecart','Chest Minecart','Hopper Minecart',
  'Oak Boat','Sponge','Wet Sponge','Cobweb','Ladder','Bone','Bone Meal','Ink Sac','Glow Ink Sac','Emerald','Lapis Lazuli',
  'Quartz','Amethyst Cluster','Budding Amethyst','Calcite','Tuff','Deepslate','Reinforced Deepslate','Bedrock',
  'Grass Block','Mycelium','Podzol','Netherrack','Soul Sand','Magma Block','End Stone','Purpur Block','Prismarine',
  'Dark Prismarine','Honey Block','Slime Block','Beehive','Lodestone','Bell','Chiseled Bookshelf','Decorated Pot',
  'Suspicious Sand','Sniffer Egg','Torchflower','Pitcher Plant','Cherry Sapling','Mangrove Propagule','Moss Block',
  'Azalea','Big Dripleaf','Small Dripleaf','Glow Lichen','Rooted Dirt','Hanging Roots','Dripstone Block',
];

export const MC_MOBS = [
  'Creeper','Enderman','Zombie','Skeleton','Spider','Cave Spider','Witch','Villager','Iron Golem','Snow Golem',
  'Wither','Ender Dragon','Blaze','Ghast','Slime','Magma Cube','Piglin','Piglin Brute','Hoglin','Zoglin','Strider',
  'Warden','Allay','Axolotl','Goat','Frog','Tadpole','Sniffer','Camel','Armadillo','Breeze','Bogged','Creaking',
  'Guardian','Elder Guardian','Shulker','Phantom','Drowned','Husk','Stray','Vex','Evoker','Vindicator','Pillager',
  'Ravager','Wandering Trader','Llama','Trader Llama','Panda','Fox','Bee','Dolphin','Turtle','Parrot','Ocelot',
  'Wolf','Cat','Sheep','Cow','Mooshroom','Pig','Chicken','Rabbit','Squid','Glow Squid','Bat','Silverfish','Endermite',
  'Zombified Piglin','Wither Skeleton','Skeleton Horse','Zombie Villager','Polar Bear','Horse','Donkey','Mule',
  'Salmon','Cod','Pufferfish','Tropical Fish','Bogged','Illusioner','Zombie Horse','Giant',
];

// Facts used by the no-host text rounds. Kept short and checkable.
export const MC_FACTS = [
  ['What is the maximum stack size for most items in Minecraft?', '64', ['16','32','64','99']],
  ['Which block is required to build a Nether portal frame?', 'Obsidian', ['Obsidian','Bedrock','Blackstone','Basalt']],
  ['How many Eyes of Ender are needed to activate an End portal?', '12', ['9','12','16','8']],
  ['What is the rarest ore found naturally in the Overworld?', 'Emerald ore', ['Diamond ore','Emerald ore','Gold ore','Ancient Debris']],
  ['Which mob drops the Nether Star?', 'The Wither', ['Ender Dragon','The Wither','Warden','Elder Guardian']],
  ['At which Y level is diamond most commonly found in modern versions?', 'Y = -59', ['Y = 11','Y = -59','Y = 0','Y = -32']],
  ['What does the Totem of Undying do?', 'Prevents death once', ['Prevents death once','Grants flight','Doubles damage','Instantly heals']],
  ['Which mob is blind and hunts purely by vibration?', 'Warden', ['Warden','Enderman','Ghast','Phantom']],
  ['What is the name of the final boss dimension in Minecraft?', 'The End', ['The Nether','The End','The Void','The Deep Dark']],
  ['Which food item gives the most saturation in Minecraft?', 'Golden Carrot', ['Steak','Golden Carrot','Enchanted Golden Apple','Cooked Salmon']],
  ['What material is needed to upgrade Diamond gear to Netherite?', 'Netherite Ingot', ['Netherite Scrap','Netherite Ingot','Ancient Debris','Netherite Block']],
  ['How much health does the Ender Dragon have?', '200', ['100','150','200','300']],
  ['Which mob can pick up and move blocks?', 'Enderman', ['Enderman','Creeper','Zombie','Vex']],
  ['What is the maximum enchantment level obtainable at an enchanting table?', '30', ['20','25','30','50']],
  ['Which biome was added in the Caves and Cliffs update alongside Lush Caves?', 'Dripstone Caves', ['Dripstone Caves','Cherry Grove','Mangrove Swamp','Deep Dark']],
  ['What do you need to tame a cat?', 'Raw Fish', ['Bones','Raw Fish','Wheat','Seeds']],
  ['Which item lets you glide through the air?', 'Elytra', ['Elytra','Firework Rocket','Feather','Phantom Membrane']],
  ['Who is the creator of Minecraft?', 'Markus Persson (Notch)', ['Markus Persson (Notch)','Gabe Newell','Jens Bergensten','Hideo Kojima']],
  ['What is the name of the update that added the Warden and Deep Dark?', 'The Wild Update', ['Caves and Cliffs','The Wild Update','Trails and Tales','Tricky Trials']],
  ['Which mob explodes when it gets close to you?', 'Creeper', ['Creeper','Ghast','Blaze','Silverfish']],
];
