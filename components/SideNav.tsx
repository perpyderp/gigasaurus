import Image from "next/image"
import Link from "next/link"

const links = [
    {
        name: "Home",
        href: "/"
    },
    {
        name: "Tame Tracker",
        href: "/tame-tracker"
    },
    {
        name: "Calendar",
        href: "/calendar"
    }
]

export const SideNav:React.FC = () => {

    return (
        <nav className="flex flex-col justify-center items-center h-full w-64 text-xl py-5 px-5 z-50">
            <div className="flex-shrink-0">
                <Link
                    href="/"
                >
                    <Image
                        src="/giga-glasses.png"
                        width={225}
                        height={225}
                        className="opacity-50"
                        alt="giga-glasses"
                    />
                </Link>
            </div>
            <ul className="flex flex-col gap-2">
                {links.map((link) =>
                    <li
                        key={link.name}
                        className=""
                    >
                        <Link
                            href={link.href}
                        >
                            {link.name}
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    )
}