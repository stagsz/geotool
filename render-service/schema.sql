CREATE TABLE IF NOT EXISTS bot_hits
(
    botId                Nullable(String),
    botName              Nullable(String),
    confidence           UInt8,
    url                  String,
    pageType             String,
    transformationApplied UInt8,
    timestamp            DateTime,
    ip                   String,
    fingerprint          Nullable(String),
    responseStatus       Nullable(UInt16)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, url)
TTL timestamp + INTERVAL 1 YEAR DELETE;
