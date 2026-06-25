import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProducts } from '@/hooks/useStock';
import { ProductDialog } from './ProductDialog';
import { 
  productCategoryLabels, 
  productCategoryColors, 
  ProductCategory,
  Product
} from '@/types/stock';
import { Plus, Search, Package, ArrowUpDown } from 'lucide-react';

export const ProductsList = () => {
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useProducts(
    categoryFilter === 'all' ? undefined : categoryFilter
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catalogue Produits
          </CardTitle>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Produit
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou code..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select 
              value={categoryFilter} 
              onValueChange={(v) => setCategoryFilter(v as ProductCategory | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="MP">Matière Première</SelectItem>
                <SelectItem value="WIP">En-cours</SelectItem>
                <SelectItem value="PF">Produit Fini</SelectItem>
                <SelectItem value="EMB">Emballage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun produit trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      Rotation
                    </span>
                  </TableHead>
                  <TableHead>Seuils (min/sécu/max)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono">{product.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.variety && (
                          <p className="text-xs text-muted-foreground">{product.variety}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${productCategoryColors[product.category]} text-white`}>
                        {productCategoryLabels[product.category]}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>
                      <Badge variant={product.rotation_rule === 'FEFO' ? 'default' : 'outline'}>
                        {product.rotation_rule}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {product.threshold_min} / {product.threshold_security} / {product.threshold_max || '∞'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedProduct(product)}
                      >
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        product={null}
      />

      {selectedProduct && (
        <ProductDialog
          open={true}
          onOpenChange={() => setSelectedProduct(null)}
          product={selectedProduct}
        />
      )}
    </>
  );
};
