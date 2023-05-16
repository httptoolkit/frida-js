use std::process;
use std::time::Duration;
use std::thread::sleep;

#[no_mangle] // Without this, this gets inlined, which is awkward for simple testing
pub fn should_continue() -> bool {
    return true;
}

pub fn main() {
    // Useful for manual debugging:
    println!(
        "Starting with PID {}, should_continue is at {:p}",
        process::id(),
        should_continue as *const ()
    );

    // Loop until should_continue() returns false (i.e. forever, unless
    // somebody were to modify that function somehow...
    while should_continue() {
        println!("Running");
        sleep(Duration::from_millis(100));
    }

    println!("Done");
}
