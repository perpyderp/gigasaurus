import { Header } from "@/components/Header"
import { SideNav } from "@/components/SideNav"
import Image from "next/image"

export default function Home() {
    return (
        <>
            <SideNav />
            <Header />
            <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-theme-tan-100 w-full">
                <h1 className="font-ark text-3xl">Gigasaurus</h1>
            </main>
        </>
    )
}
