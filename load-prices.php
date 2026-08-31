<?php
// load-prices.php - загружает цены из JSON файла
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if (file_exists('prices.json')) {
    $data = file_get_contents('prices.json');
    echo $data;
} else {
    // Если файла нет - возвращаем стандартные цены
    $defaultPrices = [
        'granite' => 5000,
        'black_galaxy' => 5500,
        'ninimyaki' => 4500,
        'marble' => 8000,
        'red_granite' => 7000,
        'beige_granite' => 6500,
        'gray_granite' => 6000,
        'base_granite' => 4000,
        'base_marble' => 6000,
        'base_red_granite' => 5500,
        'base_other' => 3500,
        'grass' => 500,
        'gravel' => 800,
        'marble_chips' => 1500,
        'red_gravel' => 1200,
        'blue_gravel' => 1200,
        'black_gravel' => 1400,
        'sand' => 600,
        'flowers' => 1800,
        'moss' => 900,
        'pipe' => 800,
        'chain' => 600,
        'casting' => 2000,
        'model_3d' => 2500,
        'venzel' => 2200,
        'stele_work' => 5000,
        'engraving' => 1500,
        'photo' => 2000,
        'delivery' => 3000,
        'install' => 5000
    ];
    echo json_encode($defaultPrices, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>