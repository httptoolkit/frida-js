use std::time::Duration;
use std::{env, process};
use std::sync::Arc;
use std::net::SocketAddr;
use std::convert::Infallible;
use hyper::{Body, Request, Response, Server, service::{make_service_fn, service_fn}, Error as HyperError};
use tokio::task;
use tokio::time::sleep;

// A test web server: takes a message on the command-line, then servers it back to the
// first request, and then shut down.

#[tokio::main]
pub async fn main() {
    // Read incoming args directly at startup, and use them to configure our server. I sure
    // hope nobody attaches to the process & rewrites how server_message handles that argument
    // before the server starts running...
    let args: Vec<String> = env::args().collect();
    let message = format!("{:?}", &args[1..]);

    task::spawn(async {
        sleep(Duration::from_millis(2000)).await;
        println!("Exiting due to timeout");
        process::exit(2);
    });

    serve_message(message.as_str()).await;
}

#[no_mangle]
pub async fn serve_message(message: &str) {
    // ^ We use &str here just because it's easier to mess with via Frida.

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));

    let message = Arc::new(message.to_string());

    let make_svc = make_service_fn(move |_conn| {
        let message = Arc::clone(&message);
        async {
            Ok::<_, Infallible>(service_fn(move |_: Request<Body>| {
                let message = Arc::clone(&message);
                async move {
                    // Shutting down the server happily, just after this response completes
                    task::spawn(async {
                        println!("Exiting after request");
                        process::exit(0);
                    });

                    return Ok::<_, HyperError>(
                        Response::builder()
                            .status(200)
                            .header("Access-Control-Allow-Origin", "*")
                            .body(Body::from(Arc::clone(&message).to_string()))
                            .unwrap()
                    );
                }
            }))
        }
    });

    let server = Server::bind(&addr).serve(make_svc);

    if let Err(e) = server.await {
        // Log, then shut down the server unhappily on any errors
        eprintln!("Exiting after server error: {}", e);
        process::exit(1);
    }
}