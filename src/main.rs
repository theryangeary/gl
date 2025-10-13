mod database;
mod handlers;
mod models;

use axum::{
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use rust_embed::Embed;
use sqlx::{Acquire, SqlitePool};
use std::path::{Path, PathBuf};
use std::time::Duration;
use std::{env, sync::Arc};
use tokio::time::interval;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use database::Database;
use handlers::{
    category, create_category, create_entry, delete_category, delete_entry, get_categories,
    get_entries, grocery, reorder_categories, reorder_entries, update_category, update_entry,
};

static INDEX_HTML: &str = "index.html";

#[derive(Embed)]
#[folder = "./ts/dist"]

struct Assets;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "grocery_list_backend=debug,tower_http=debug,axum::rejection=trace,sqlx=debug"
                    .into()
            }),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_level(true)
                .with_thread_ids(true)
                .pretty(), // Makes it more readable
        )
        .init();

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:grocery.db".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());

    let is_demo = std::env::var("GL_DEMO")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);
    let demo_db_path = PathBuf::from("grocery_demo.db");

    tracing::info!("Starting grocery list backend on port {}", port);
    tracing::info!("Database URL: {}", database_url);
    tracing::info!("Gl is running in demo mode: {}", is_demo);

    let db = Arc::new(Database::new(&database_url).await?);

    if is_demo {
        let _reset_handle = spawn_database_reset_task(db.pool.clone(), demo_db_path);
    }

    let app = Router::new()
        .fallback(static_handler)
        .route("/api/entries", get(get_entries))
        .route("/api/entries", post(create_entry))
        .route("/api/entries/:id", put(update_entry))
        .route("/api/entries/:id", delete(delete_entry))
        .route("/api/entries/reorder", put(reorder_entries))
        .route("/api/entries/suggestions", get(grocery::get_suggestions))
        .route("/api/categories", get(get_categories))
        .route("/api/categories", post(create_category))
        .route("/api/categories/:id", put(update_category))
        .route("/api/categories/:id", delete(delete_category))
        .route("/api/categories/reorder", put(reorder_categories))
        .route(
            "/api/categories/suggestions",
            get(category::get_suggestions),
        )
        .route("/health", get(health_check))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(db);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("Grocery List API server running on port {}", port);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    })))
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() || path == INDEX_HTML {
        return index_html().await;
    }

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();

            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if path.contains('.') {
                return not_found().await;
            }

            index_html().await
        }
    }
}

async fn index_html() -> Response {
    match Assets::get(INDEX_HTML) {
        Some(content) => {
            let is_demo = std::env::var("GL_DEMO")
                .unwrap_or_else(|_| "false".to_string())
                .parse::<bool>()
                .unwrap_or(false);

            let template =
                String::from_utf8(content.data.to_vec()).expect("index should be valid utf-8");

            let index = template.replace("__IS_DEMO__", &is_demo.to_string());
            Html(index).into_response()
        }
        None => not_found().await,
    }
}

async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "404").into_response()
}

/// Resets the database by executing SQL commands to clear and repopulate data
async fn reset_database(
    pool: &SqlitePool,
    demo_db_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
let mut pool =  pool.acquire().await?;
    // Attach the demo database
    sqlx::query("ATTACH DATABASE ? AS demo")
        .bind(demo_db_path.to_str().unwrap())
        .execute(&mut *pool)
        .await?;

    // Get all table names from the main database
    let tables: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(&mut *pool)
    .await?;

    // Begin transaction
    let mut tx = pool.begin().await?;

    // Delete all data from each table
    for (table_name,) in &tables {
        let delete_sql = format!("DELETE FROM main.{}", table_name);
        sqlx::query(&delete_sql).execute(&mut *tx).await?;
    }

    // Copy data from demo database to main database
    for (table_name,) in &tables {
        let insert_sql = format!(
            "INSERT INTO main.{} SELECT * FROM demo.{}",
            table_name, table_name
        );
        sqlx::query(&insert_sql).execute(&mut *tx).await?;
    }

    // Commit transaction
    tx.commit().await?;

    // Detach the demo database
    sqlx::query("DETACH DATABASE demo").execute(&mut *pool).await?;

    // Run VACUUM to clean up and reset the database file
    sqlx::query("VACUUM").execute(&mut *pool).await?;

    tracing::debug!("Database reset completed at {}", chrono::Local::now());

    Ok(())
}

/// Spawns a background task that resets the database every 15 minutes
pub fn spawn_database_reset_task(
    pool: SqlitePool,
    demo_db_path: PathBuf,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(15*60));

        loop {
            ticker.tick().await;

            tracing::debug!("Starting database reset...");

            if let Err(e) = reset_database(&pool, &demo_db_path).await {
                tracing::error!("Failed to reset database: {}", e);
            }
        }
    })
}
