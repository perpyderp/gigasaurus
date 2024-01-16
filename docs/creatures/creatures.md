# Creatures

Creatures and all groups under creatures have similar attributes. Below you can find an example of how Compy would be defined.

```json
{
    "name": "Compy",
    "dossier": {
        "species": "Compsognathus curiosicarius",
        "time": "Late Jurassic",
        "diet": "Carnivore",
        "temperament": "Curious",
        "wild": "One of the smallest predators on the Island, Compsognathus curiosicarius can be seen as a pet, a pest, or a threat. While alone, Compsognathus is not dangerous or aggressive. In larger packs, however, it remembers its underlying carnivorous nature. After a group of Compsognathus grows to a certain size, their pack mentality always seems to embolden them to “attack.” For some reason, Compsognathus is not naturally afraid of humans. Rather, it seems to be quite curious about humans and their instruments of survival. They tend to be drawn toward humans out of this curiosity, and then call their pack mates to help explore their discovery. This usually leads to the aforementioned pack aggression, with dangerous results.",
        "domesticated": "Compsognathus gain increasingly significant attack power and speed when in close proximity to other Compsognathus, as their pack aggression takes over their behavior. Additionally, their distress call carries quite far, rapidly alerting the tribe and its pets to danger more efficiently, and increasing the likelihood of forming a so-called \"Compy Gang.\""
    },
    "base_stats_growth": {
        "health": {
            "base": 50,
            "level_increase": {
                "wild": 10,
                "tamed": 0.064
            },
            "taming_bonus": {
                "additive": 0.07
            }
        },
        "stamina": {
            "base": 100,
            "level_increase": {
                "wild": 10,
                "tamed": 0.1
            }
        },
        "oxygen": {
            "base": 150,
            "level_increase": {
                "wild": 15,
                "tamed": 0.1
            }
        },
        "food": {
            "base": 450,
            "level_increase": {
                "wild": 45,
                "tamed": 0.1
            },
            "taming_bonus": {
                "multiplicative": 0.15
            }
        },
        "weight": {
            "base": 25,
            "level_increase": {
                "wild": 0.5,
                "tamed": 0.04
            }
        },
        "melee": {
            "base": 4,
            "level_increase": {
                "wild": 0.2,
                "tamed": 0.017
            },
            "taming_bonus": {
                "additive": 0.14,
                "multiplicative": 0.176
            }
        },
        "movement": {
            "base": 100,
            "level_increase": {
                "wild": null,
                "tamed": 0.01
            },
            "taming_bonus": {
                "additive": 1
            }
        },
        "torpidity": {
            "base": 350,
            "level_increase": {
                "wild": 21,
                "tamed": null
            },
            "taming_bonus": {
                "additive": 0.5
            }
        }
    },
    "tameable": true,
    "rideable": false,
    "breedable": true,
    "taming": {
        "method": "Knockout",
        "kibble": null
    },
    "saddle": null,
    "rider_weaponry": false,
    "egg": {
        "name": "Compy Egg",
        "incubation": {
            "range": "24 - 32 °C / 75 - 90 °F",
            "incubation_range": "28 °C / 82 °F",
            "incubation_time": "49m 59.76s"
        },
        "baby_time": "2h 6m 15.758s",
        "juvenile_time": "8h 25m 3.03s",
        "adolescent_time": "10h 31m 18.788s",
        "total_maturation": "21h 2m 37.576s",
        "breeding_interval": "18h - 2d"
    },
    "drag_weight": 20,
    "cloneable": true,
    "entity_id": "Compy_Character_BP_C"
}
```
