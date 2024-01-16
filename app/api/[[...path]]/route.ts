import { NextRequest, NextResponse } from "next/server"
import DinosaurSchema from "@/schemas/CreatureSchema.json"
import fs from "fs"
import path from "path"

interface PathProps {
    params: {
        path: string[]
    }
}

export async function GET(request:NextRequest, { params }: PathProps) {

    // Get the requested path
    const reqPath = params.path

    if(!reqPath) return NextResponse.json({ message: "Welcome to the ARK API!" }, { status: 200 })

    // Build the path
    const fullPath = path.resolve("./assets/data/" + reqPath.join("/") + "/data.json");

    try {
        if(fs.existsSync(fullPath)) {
            const jsonData = fs.readFileSync(fullPath, "utf-8")
            const parsedData = JSON.parse(jsonData);

            return NextResponse.json({ data:parsedData }, { status: 200 })
        } else {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
    } catch(error) {
        return NextResponse.json({ error: "Error occurred reading json"}, { status: 500 })
    }

}