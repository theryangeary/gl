-- Add migration script here
-- create a new table 
CREATE TABLE IF NOT EXISTS grocery_list_entries_tmp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    completed_at TIMESTAMP,
    archived_at TIMESTAMP,
    position INTEGER,
    quantity TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    category_id INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    UNIQUE(category_id, position)
    CHECK ((archived_at IS NULL) <> (position IS NULL))
);
-- copy data from old table to the new one
INSERT INTO grocery_list_entries_tmp SELECT * FROM grocery_list_entries gle;

-- drop the old table
DROP TABLE grocery_list_entries;

-- rename new table to the old one
ALTER TABLE grocery_list_entries_tmp RENAME TO grocery_list_entries;
