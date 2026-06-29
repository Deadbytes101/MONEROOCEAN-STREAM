use std::env;

fn main() {
    let mut args = env::args().skip(1);

    match args.next().as_deref() {
        Some("identity") => print_identity(),
        Some("help") | Some("--help") | Some("-h") | None => print_help(),
        Some(command) => {
            eprintln!("unknown command: {command}");
            print_help();
            std::process::exit(2);
        }
    }
}

fn print_help() {
    println!("dbyte-agent {}", env!("CARGO_PKG_VERSION"));
    println!("commands:");
    println!("  identity    print local machine identity report");
}

fn print_identity() {
    let cwd = env::current_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());

    println!("agent.version={}", env!("CARGO_PKG_VERSION"));
    println!("os={}", env::consts::OS);
    println!("arch={}", env::consts::ARCH);
    println!("cwd={cwd}");
}