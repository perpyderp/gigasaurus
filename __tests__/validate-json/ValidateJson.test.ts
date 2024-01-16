import fs from 'fs';
import { describe, expect, test } from '@jest/globals';
import CreatureSchema from "@/schemas/CreatureSchema.json"
import path from 'path';
import Ajv from "ajv"

const ajv = new Ajv({ allowUnionTypes: true });
// const validateDinosaur = ajv.compile(CreatureSchema);

function traverseDirectory(dirPath: string) {
    // Read the contents of the directory
    const files = fs.readdirSync(dirPath);

    // Iterate through the files
    files.forEach(file => {
        // Get the full path of the current file or directory
        const fullPath = path.join(dirPath, file);

        // Check if it's a directory
        if (fs.statSync(fullPath).isDirectory()) {
            // If it's a directory, recursively traverse it
            traverseDirectory(fullPath);
        } else {

            try {
                // If it's a file, you can do something with it
                const jsonData = fs.readFileSync(fullPath, "utf-8")
                const parsedData = JSON.parse(jsonData);

                test("Valid data: " + fullPath, () => {

                    const valid = ajv.validate(CreatureSchema, parsedData)
                    if(ajv.errors) console.log(ajv.errors)
                    expect(valid).toBe(true)
                
                })
            } catch(e) {
                console.log(e)
            }

        }
    });
}

describe("Validate all creature data using JSON Schema", () => {

    traverseDirectory("./assets/data/creatures")

})