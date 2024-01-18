import Link from "next/link"
import { Icons } from "./Icons"

export const Header:React.FC = () => {

    return (
        <header className="flex items-center lg:hidden fixed h-16 bg-theme-green-500 z-50 shadow-md overflow-hidden w-full">
            <Link href="/" className="flex-1 pl-4 md:pl-8 font-display text-3xl font-black text-white relative z-10 font-ark">
                Gigasaurus
            </Link>
            <div className="p-8 cursor-pointer">
                <Icons.menubar color="white" />
            </div>
        </header>
    )

}